/* eslint-env browser */
import shaderCode from '../shaders/heatmap.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'
import { buildColorRamp } from 'style/color'

import type { WebGPUContext } from '../context'
import type { HeatmapFeature, HeatmapSource, HeatmapWorkflow as HeatmapWorkflowSpec } from './workflow.spec'
import type {
  HeatmapLayerDefinition,
  HeatmapLayerStyle,
  HeatmapWorkflowLayerGuideGPU,
  LayerDefinitionBase
} from 'style/style.spec'
import type { HeatmapData } from 'workers/worker.spec'
import type { TileGPU as Tile } from 'source/tile.spec'

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  { // pos
    arrayStride: 4 * 2,
    stepMode: 'instance',
    attributes: [{
      shaderLocation: 0,
      offset: 0,
      format: 'float32x2'
    }]
  },
  { // weight
    arrayStride: 4,
    stepMode: 'instance',
    attributes: [{
      shaderLocation: 0,
      offset: 0,
      format: 'float32'
    }]
  }
]

export default class HeatmapWorkflow implements HeatmapWorkflowSpec {
  context: WebGPUContext
  layerGuides = new Map<number, HeatmapWorkflowLayerGuideGPU>()
  pipeline!: GPURenderPipeline
  texturePipeline!: GPURenderPipeline
  module!: GPUShaderModule
  #renderTarget!: GPUTexture
  #heatmapBindGroupLayout!: GPUBindGroupLayout
  #heatmapTextureBindGroupLayout!: GPUBindGroupLayout
  #renderPassDescriptor!: GPURenderPassDescriptor
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    const { context } = this
    const { device } = context
    this.#heatmapTextureBindGroupLayout = context.buildLayout('Heatmap BindGroupLayout', ['uniform'], GPUShaderStage.VERTEX)
    this.#heatmapBindGroupLayout = device.createBindGroupLayout({
      label: 'Heatmap BindGroupLayout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform', hasDynamicOffset: false, minBindingSize: 0 }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' }
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' }
        },
        {
          binding: 4,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' }
        }
      ]
    })
    this.module = device.createShaderModule({ code: shaderCode })

    this.pipeline = await this.#getPipeline('screen')
    this.texturePipeline = await this.#getPipeline('texture')
  }

  resize (): void {
    const { device, presentation, sampleCount, format } = this.context
    if (this.#renderTarget !== undefined) this.#renderTarget.destroy()
    this.#renderTarget = device.createTexture({
      size: presentation,
      sampleCount,
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    })
    // setup render pass descriptor
    this.#renderPassDescriptor = {
      colorAttachments: [{
        view: this.#renderTarget.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    }
  }

  destroy (): void {
    for (const { layerBuffer, layerCodeBuffer } of this.layerGuides.values()) {
      layerBuffer.destroy()
      layerCodeBuffer.destroy()
    }
  }

  // programs helps design the appropriate layer parameters
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: HeatmapLayerStyle): HeatmapLayerDefinition {
    const { context } = this
    const { source, layerIndex, lch } = layerBase
    // PRE) get layer base
    let {
      // paint
      radius, opacity, intensity,
      // layout
      colorRamp, weight
    } = layer
    radius = radius ?? 1
    opacity = opacity ?? 1
    intensity = intensity ?? 1
    colorRamp = colorRamp ?? 'sinebow'
    // 1) build definition
    const layerDefinition: HeatmapLayerDefinition = {
      ...layerBase,
      type: 'heatmap' as const,
      // paint
      radius,
      opacity,
      intensity,
      // layout
      colorRamp,
      weight: weight ?? 1
    }
    // 2) build layer code
    const layerCode: number[] = []
    for (const paint of [radius, opacity, intensity]) {
      layerCode.push(...encodeLayerAttribute(paint, lch))
    }
    // 3) Setup layer buffers in GPU
    const layerBuffer = context.buildStaticGPUBuffer('Layer Uniform Buffer', 'float', [context.getDepthPosition(layerIndex), ~~lch], GPUBufferUsage.UNIFORM)
    const layerCodeBuffer = context.buildStaticGPUBuffer('Layer Code Buffer', 'float', [...layerCode, ...Array(128 - layerCode.length).fill(0)], GPUBufferUsage.STORAGE)
    // 4) Store layer guide
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      layerBuffer,
      layerCodeBuffer,
      lch,
      colorRamp: context.buildTexture(buildColorRamp(colorRamp, lch), 256, 4)
    })

    return layerDefinition
  }

  buildSource (heatmapData: HeatmapData, tile: Tile): void {
    const { context } = this
    const { vertexBuffer, weightBuffer, featureGuideBuffer } = heatmapData
    // prep buffers
    const source: HeatmapSource = {
      type: 'heatmap' as const,
      vertexBuffer: context.buildGPUBuffer('Heatmap Vertex Buffer', new Float32Array(vertexBuffer), GPUBufferUsage.VERTEX),
      weightBuffer: context.buildGPUBuffer('Heatmap Weight Buffer', new Float32Array(weightBuffer), GPUBufferUsage.VERTEX),
      destroy: () => {
        const { vertexBuffer, weightBuffer } = source
        vertexBuffer.destroy()
        weightBuffer.destroy()
      }
    }
    // build features
    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer))
  }

  #buildFeatures (source: HeatmapSource, tile: Tile, featureGuideArray: Float32Array): void {
    const { context } = this
    const { mask } = tile
    const features: HeatmapFeature[] = []

    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4)
      i += 4
      // build featureCode
      const featureCode: number[] = encodingSize > 0
        ? [...featureGuideArray.slice(i, i + encodingSize)]
        : [0]
      // update index
      i += encodingSize

      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      const { sourceName, lch, colorRamp, layerBuffer, layerCodeBuffer } = layerGuide

      const heatmapUniformBuffer = context.buildStaticGPUBuffer('Heatmap Uniform Buffer', 'float', [0, 0, 8192, 8192], GPUBufferUsage.UNIFORM)
      const heatmapBindGroup = context.buildGroup(
        'Heatmap BindGroup',
        this.#heatmapBindGroupLayout,
        [heatmapUniformBuffer]
      )
      const featureCodeBuffer = context.buildStaticGPUBuffer('Feature Code Buffer', 'float', [...featureCode, ...Array(64 - featureCode.length).fill(0)], GPUBufferUsage.STORAGE)
      const bindGroup = context.buildGroup(
        'Feature BindGroup',
        context.featureBindGroupLayout,
        [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
      )

      const feature: HeatmapFeature = {
        type: 'heatmap' as const,
        source,
        tile,
        count,
        offset,
        sourceName,
        layerIndex,
        featureCode,
        lch,
        colorRamp,
        bindGroup,
        heatmapBindGroup,
        draw: () => {
          context.setStencilReference(tile.tmpMaskID)
          this.draw(feature)
        },
        destroy: () => {
          heatmapUniformBuffer.destroy()
          featureCodeBuffer.destroy()
        }
      }

      features.push(feature)
    }

    tile.addFeatures(features)
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 6: it is recommended to create pipeline asynchronously
  // BEST PRACTICE 7: explicitly define pipeline layouts
  async #getPipeline (type: 'texture' | 'screen'): Promise<GPURenderPipeline> {
    const { context, module } = this
    const { device, format, defaultBlend, sampleCount, frameBindGroupLayout, featureBindGroupLayout } = context
    const isScreen = type === 'screen'

    const layout = isScreen
      ? device.createPipelineLayout({
        bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.#heatmapBindGroupLayout]
      })
      : device.createPipelineLayout({
        bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.#heatmapTextureBindGroupLayout]
      })

    const stencilState: GPUStencilFaceState = {
      compare: 'always',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace'
    }

    return await device.createRenderPipelineAsync({
      layout,
      vertex: {
        module,
        entryPoint: isScreen ? 'vMain' : 'vTexture',
        buffers: isScreen ? undefined : SHADER_BUFFER_LAYOUT
      },
      fragment: {
        module,
        entryPoint: isScreen ? 'fMain' : 'fTexture',
        targets: [{
          format,
          blend: defaultBlend
        }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none'
      },
      multisample: { count: sampleCount },
      depthStencil: isScreen
        ? undefined
        : {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus-stencil8',
            stencilFront: stencilState,
            stencilBack: stencilState,
            stencilReadMask: 0xFFFFFFFF,
            stencilWriteMask: 0xFFFFFFFF
          }
    })
  }

  textureDraw (features: HeatmapFeature[]): HeatmapFeature | undefined {
    if (features.length === 0) return undefined
    const { context } = this
    const { device } = context

    // set encoders
    const commandEncoder = device.createCommandEncoder()
    const passEncoder = commandEncoder.beginRenderPass(this.#renderPassDescriptor)

    passEncoder.setPipeline(this.texturePipeline)
    for (const { bindGroup, heatmapBindGroup, source, count, offset } of features) {
      const { vertexBuffer, weightBuffer } = source
      // setup pipeline, bind groups, & buffers
      passEncoder.setBindGroup(1, bindGroup)
      passEncoder.setBindGroup(2, heatmapBindGroup)
      passEncoder.setVertexBuffer(0, vertexBuffer)
      passEncoder.setVertexBuffer(1, weightBuffer)
      // draw
      passEncoder.draw(6, count, 0, offset)
    }
    // finish
    passEncoder.end()
    device.queue.submit([commandEncoder.finish()])

    return features[0]
  }

  draw (_featureGuide: HeatmapFeature): void {
    // get current source data
    const { passEncoder } = this.context
    // setup pipeline, bind groups, & buffers
    passEncoder.setPipeline(this.pipeline)
    // draw a screen quad
    passEncoder.draw(6, 1)
  }
}
