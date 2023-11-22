/* eslint-env browser */
import shaderCode from '../shaders/raster.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type { WebGPUContext } from '../context'
import type { RasterFeature, RasterSource, RasterWorkflow as RasterWorkflowSpec } from './workflow.spec'
import type {
  LayerDefinitionBase,
  RasterLayerDefinition,
  RasterLayerStyle,
  RasterWorkflowLayerGuideGPU
} from 'style/style.spec'
import type { RasterData } from 'workers/worker.spec'
import type { TileGPU as Tile } from 'source/tile.spec'

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  { // position
    arrayStride: 4 * 2,
    attributes: [{
      shaderLocation: 0,
      offset: 0,
      format: 'float32x2'
    }]
  }
]

export default class RasterWorkflow implements RasterWorkflowSpec {
  context: WebGPUContext
  layerGuides = new Map<number, RasterWorkflowLayerGuideGPU>()
  pipeline!: GPURenderPipeline
  #rasterBindGroupLayout!: GPUBindGroupLayout
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    this.pipeline = await this.#getPipeline()
  }

  destroy (): void {
    for (const { layerBuffer, layerCodeBuffer } of this.layerGuides.values()) {
      layerBuffer.destroy()
      layerCodeBuffer.destroy()
    }
  }

  // programs helps design the appropriate layer parameters
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: RasterLayerStyle): RasterLayerDefinition {
    const { context } = this
    const { source, layerIndex, lch } = layerBase
    // PRE) get layer base
    let { opacity, saturation, contrast, resampling, fadeDuration } = layer
    opacity = opacity ?? 1
    saturation = saturation ?? 0
    contrast = contrast ?? 0
    // 1) build definition
    const layerDefinition: RasterLayerDefinition = {
      ...layerBase,
      type: 'raster' as const,
      opacity: opacity ?? 1,
      saturation: saturation ?? 0,
      contrast: contrast ?? 0
    }
    // 2) Store layer workflow
    const layerCode: number[] = []
    for (const paint of [opacity, saturation, contrast]) {
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
      lch,
      fadeDuration: fadeDuration ?? 300,
      resampling: resampling ?? 'linear',
      layerBuffer,
      layerCodeBuffer
    })

    return layerDefinition
  }

  buildSource (rasterData: RasterData, tile: Tile): void {
    const { context } = this
    const { image, built, size } = rasterData
    const { mask } = tile

    const texture = context.buildTexture(
      built ? image as ImageBitmap : new Uint8ClampedArray(image as ArrayBuffer),
      size,
      size
    )
    // prep buffers
    const source: RasterSource = {
      type: 'raster' as const,
      texture,
      vertexBuffer: mask.vertexBuffer,
      indexBuffer: mask.indexBuffer,
      count: mask.count,
      offset: mask.offset,
      destroy: () => { texture.destroy() }
    }
    // build features
    this.#buildFeatures(source, rasterData, tile)
  }

  #buildFeatures (source: RasterSource, rasterData: RasterData, tile: Tile): void {
    const { context } = this
    const { sourceName, featureGuides } = rasterData
    const { mask } = tile
    // for each layer that maches the source, build the feature

    const features: RasterFeature[] = []

    for (const { code, layerIndex } of featureGuides) {
      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      const { layerBuffer, layerCodeBuffer, resampling, fadeDuration, lch } = layerGuide

      const rasterFadeBuffer = context.buildStaticGPUBuffer('Raster Uniform Buffer', 'float', [1], GPUBufferUsage.UNIFORM)
      const sampler = context.buildSampler(resampling, false)
      const rasterBindGroup = context.device.createBindGroup({
        label: 'Raster BindGroup',
        layout: this.#rasterBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: rasterFadeBuffer }
          },
          {
            binding: 1,
            resource: sampler
          },
          {
            binding: 2,
            resource: source.texture.createView()
          }
        ]
      })
      const featureCodeBuffer = context.buildStaticGPUBuffer('Feature Code Buffer', 'float', [...code, ...Array(64 - code.length).fill(0)], GPUBufferUsage.STORAGE)
      const bindGroup = context.buildGroup(
        'Feature BindGroup',
        context.featureBindGroupLayout,
        [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
      )

      const feature: RasterFeature = {
        type: 'raster' as const,
        tile,
        source,
        sourceName,
        layerIndex,
        lch,
        featureCode: code,
        fadeDuration,
        bindGroup,
        rasterBindGroup,
        fadeStartTime: Date.now(),
        draw: () => {
          context.setStencilReference(tile.tmpMaskID)
          this.draw(feature)
        },
        destroy: () => {
          rasterFadeBuffer.destroy()
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
  async #getPipeline (): Promise<GPURenderPipeline> {
    const { context } = this
    const { device, format, sampleCount, frameBindGroupLayout, featureBindGroupLayout } = context

    // prep raster uniforms
    this.#rasterBindGroupLayout = context.device.createBindGroupLayout({
      label: 'Raster BindGroupLayout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
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
        }
      ]
    })

    const module = device.createShaderModule({ code: shaderCode })
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.#rasterBindGroupLayout]
    })
    const stencilState: GPUStencilFaceState = {
      compare: 'equal',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace'
    }

    return await device.createRenderPipelineAsync({
      layout,
      vertex: {
        module,
        entryPoint: 'vMain',
        buffers: SHADER_BUFFER_LAYOUT
      },
      fragment: {
        module,
        entryPoint: 'fMain',
        targets: [{ format }]
      },
      primitive: {
        topology: 'triangle-strip',
        cullMode: 'back',
        stripIndexFormat: 'uint32'
      },
      multisample: { count: sampleCount },
      depthStencil: {
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

  draw (featureGuide: RasterFeature): void {
    // get current source data
    const { passEncoder } = this.context
    const { bindGroup, rasterBindGroup, source } = featureGuide
    const { vertexBuffer, indexBuffer, count, offset } = source

    // setup pipeline, bind groups, & buffers
    passEncoder.setPipeline(this.pipeline)
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setBindGroup(2, rasterBindGroup)
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setIndexBuffer(indexBuffer, 'uint32')
    // draw
    passEncoder.drawIndexed(count, 1, offset, 0, 0)
  }
}
