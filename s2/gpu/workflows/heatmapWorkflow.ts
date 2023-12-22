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
      shaderLocation: 1,
      offset: 0,
      format: 'float32'
    }]
  }
]

// TODO: The texture target should just have a single float channel?

export default class HeatmapWorkflow implements HeatmapWorkflowSpec {
  context: WebGPUContext
  layerGuides = new Map<number, HeatmapWorkflowLayerGuideGPU>()
  pipeline!: GPURenderPipeline
  module!: GPUShaderModule
  texturePipeline!: GPURenderPipeline
  #heatmapBindGroupLayout!: GPUBindGroupLayout
  #heatmapTextureBindGroupLayout!: GPUBindGroupLayout
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    const { context } = this
    const { device } = context
    this.#heatmapTextureBindGroupLayout = context.buildLayout('Heatmap Texture BindGroupLayout', ['uniform'], GPUShaderStage.VERTEX)
    this.#heatmapBindGroupLayout = device.createBindGroupLayout({
      label: 'Heatmap BindGroupLayout',
      entries: [
        // sampler
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        // render target
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        // color ramp
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }
      ]
    })

    this.module = device.createShaderModule({ code: shaderCode })
    this.pipeline = await this.#getPipeline('screen')
    this.texturePipeline = await this.#getPipeline('texture')
  }

  resize (): void {
    for (const layerGuide of this.layerGuides.values()) {
      if (layerGuide.renderTarget !== undefined) layerGuide.renderTarget.destroy()
      layerGuide.renderTarget = this.#buildLayerRenderTarget()
      // setup render pass descriptor
      layerGuide.renderPassDescriptor = this.#buildLayerPassDescriptor(layerGuide.renderTarget)
      // set up bind group
      layerGuide.textureBindGroup = this.#buildLayerBindGroup(layerGuide.renderTarget, layerGuide.colorRamp)
    }
  }

  destroy (): void {
    for (const { colorRamp, layerBuffer, layerCodeBuffer, renderTarget } of this.layerGuides.values()) {
      colorRamp.destroy()
      layerBuffer.destroy()
      layerCodeBuffer.destroy()
      renderTarget.destroy()
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
    const layerBuffer = context.buildGPUBuffer('Layer Uniform Buffer', new Float32Array([context.getDepthPosition(layerIndex), ~~lch]), GPUBufferUsage.UNIFORM)
    const layerCodeBuffer = context.buildGPUBuffer('Layer Code Buffer', new Float32Array(layerCode), GPUBufferUsage.STORAGE)
    const colorRampTexture = context.buildTexture(buildColorRamp(colorRamp, lch), 256, 5)
    const renderTarget = this.#buildLayerRenderTarget()
    // 4) Store layer guide
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      layerBuffer,
      layerCodeBuffer,
      lch,
      colorRamp: colorRampTexture,
      renderTarget,
      renderPassDescriptor: this.#buildLayerPassDescriptor(renderTarget),
      textureBindGroup: this.#buildLayerBindGroup(renderTarget, colorRampTexture)
    })

    return layerDefinition
  }

  #buildLayerRenderTarget (): GPUTexture {
    const { device, presentation, format } = this.context
    return device.createTexture({
      size: presentation,
      // sampleCount,
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    })
  }

  #buildLayerPassDescriptor (renderTarget: GPUTexture): GPURenderPassDescriptor {
    return {
      colorAttachments: [{
        view: renderTarget.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    }
  }

  #buildLayerBindGroup (renderTarget: GPUTexture, colorRamp: GPUTexture): GPUBindGroup {
    return this.context.device.createBindGroup({
      layout: this.#heatmapBindGroupLayout,
      entries: [
        { binding: 1, resource: this.context.defaultSampler },
        { binding: 2, resource: renderTarget.createView() },
        { binding: 3, resource: colorRamp.createView() }
      ]
    })
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

      const heatmapUniformBuffer = context.buildGPUBuffer('Heatmap Uniform Buffer', new Float32Array([0, 0, 1, 1]), GPUBufferUsage.UNIFORM)
      const heatmapBindGroup = context.buildGroup(
        'Heatmap BindGroup',
        this.#heatmapTextureBindGroupLayout,
        [heatmapUniformBuffer]
      )
      const featureCodeBuffer = context.buildGPUBuffer('Feature Code Buffer', new Float32Array(featureCode), GPUBufferUsage.STORAGE)
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
      label: `Heatmap ${type} Pipeline`,
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
          blend: isScreen
            ? defaultBlend
            : {
                color: { srcFactor: 'one', dstFactor: 'one' },
                alpha: { srcFactor: 'one', dstFactor: 'one' }
              }
        }]
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      multisample: { count: isScreen ? sampleCount : undefined },
      depthStencil: isScreen
        ? {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus-stencil8',
            stencilFront: stencilState,
            stencilBack: stencilState,
            stencilReadMask: 0xFFFFFFFF,
            stencilWriteMask: 0xFFFFFFFF
          }
        : undefined
    })
  }

  textureDraw (features: HeatmapFeature[]): HeatmapFeature[] | undefined {
    if (features.length === 0) return undefined
    const { context } = this
    const { device, frameBufferBindGroup } = context

    const output: HeatmapFeature[] = []
    // group by layerIndex
    const layerFeatures = new Map<number, HeatmapFeature[]>()
    for (const feature of features) {
      const { layerIndex } = feature
      const layer = layerFeatures.get(layerIndex)
      if (layer === undefined) {
        layerFeatures.set(layerIndex, [feature])
        output.push(feature)
      } else layer.push(feature)
    }

    // draw each layer to their own render target
    for (const [layerIndex, features] of layerFeatures.entries()) {
      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      // set encoders
      const commandEncoder = device.createCommandEncoder()
      const passEncoder = commandEncoder.beginRenderPass(layerGuide.renderPassDescriptor)

      passEncoder.setPipeline(this.texturePipeline)
      passEncoder.setBindGroup(0, frameBufferBindGroup)
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
    }

    return output
  }

  draw ({ bindGroup, layerIndex }: HeatmapFeature): void {
    // get current source data
    const { passEncoder } = this.context
    const layerGuide = this.layerGuides.get(layerIndex)
    if (layerGuide === undefined) return
    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(this.pipeline)
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setBindGroup(2, layerGuide.textureBindGroup)
    // draw a screen quad
    passEncoder.draw(6)
  }
}
