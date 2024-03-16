import shaderCode from '../shaders/raster.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type { WebGPUContext } from '../context'
import type {
  RasterFeature as RasterFeatureSpec,
  RasterSource,
  RasterWorkflow as RasterWorkflowSpec
} from './workflow.spec'
import type {
  LayerDefinitionBase,
  RasterDefinition,
  RasterStyle,
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

export class RasterFeature implements RasterFeatureSpec {
  type = 'raster' as const
  sourceName: string
  fadeDuration: number
  bindGroup: GPUBindGroup
  rasterBindGroup: GPUBindGroup
  constructor (
    public layerGuide: RasterWorkflowLayerGuideGPU,
    public workflow: RasterWorkflowSpec,
    public tile: Tile,
    public source: RasterSource,
    public featureCode: number[],
    public rasterFadeBuffer: GPUBuffer,
    public featureCodeBuffer: GPUBuffer,
    public fadeStartTime = Date.now(),
    public parent?: Tile
  ) {
    const { sourceName, fadeDuration } = layerGuide
    this.sourceName = sourceName
    this.fadeDuration = fadeDuration
    this.bindGroup = this.#buildBindGroup()
    this.rasterBindGroup = this.#buildRasterBindGroup()
  }

  draw (): void {
    const { tile, workflow } = this
    workflow.context.setStencilReference(tile.tmpMaskID)
    workflow.draw(this)
  }

  destroy (): void {
    const { rasterFadeBuffer, featureCodeBuffer } = this
    rasterFadeBuffer.destroy()
    featureCodeBuffer.destroy()
  }

  duplicate (tile: Tile, parent: Tile): RasterFeature {
    const {
      layerGuide, workflow, source,
      featureCode, rasterFadeBuffer, featureCodeBuffer, fadeStartTime
    } = this
    const { context } = workflow
    const cE = context.device.createCommandEncoder()
    const newRasterFadeBuffer = context.duplicateGPUBuffer(rasterFadeBuffer, cE)
    const newFeatureCodeBuffer = context.duplicateGPUBuffer(featureCodeBuffer, cE)
    context.device.queue.submit([cE.finish()])
    return new RasterFeature(
      layerGuide, workflow, tile, source, featureCode,
      newRasterFadeBuffer, newFeatureCodeBuffer, fadeStartTime, parent
    )
  }

  #buildBindGroup (): GPUBindGroup {
    const { workflow, tile, parent, layerGuide, featureCodeBuffer } = this
    const { context } = workflow
    const { mask } = parent ?? tile
    const { layerBuffer, layerCodeBuffer } = layerGuide
    return context.buildGroup(
      'Raster Feature BindGroup',
      context.featureBindGroupLayout,
      [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
    )
  }

  #buildRasterBindGroup (): GPUBindGroup {
    const { source, workflow, rasterFadeBuffer, layerGuide } = this
    const { context, rasterBindGroupLayout } = workflow
    const { resampling } = layerGuide
    const sampler = context.buildSampler(resampling)
    return context.device.createBindGroup({
      label: 'Raster BindGroup',
      layout: rasterBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: rasterFadeBuffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: source.texture.createView() }
      ]
    })
  }
}

export default class RasterWorkflow implements RasterWorkflowSpec {
  context: WebGPUContext
  layerGuides = new Map<number, RasterWorkflowLayerGuideGPU>()
  pipeline!: GPURenderPipeline
  rasterBindGroupLayout!: GPUBindGroupLayout
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
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: RasterStyle): RasterDefinition {
    const { context } = this
    const { source, layerIndex, lch, visible } = layerBase
    // PRE) get layer base
    let { opacity, saturation, contrast, resampling, fadeDuration } = layer
    opacity = opacity ?? 1
    saturation = saturation ?? 0
    contrast = contrast ?? 0
    // 1) build definition
    const layerDefinition: RasterDefinition = {
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
    const layerBuffer = context.buildGPUBuffer('Layer Uniform Buffer', new Float32Array([context.getDepthPosition(layerIndex), ~~lch]), GPUBufferUsage.UNIFORM)
    const layerCodeBuffer = context.buildGPUBuffer('Layer Code Buffer', new Float32Array(layerCode), GPUBufferUsage.STORAGE)
    // 4) Store layer guide
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      fadeDuration: fadeDuration ?? 300,
      resampling: resampling ?? 'linear',
      layerBuffer,
      layerCodeBuffer,
      visible
    })

    return layerDefinition
  }

  buildSource (rasterData: RasterData, tile: Tile): void {
    const { context } = this
    const { image, size } = rasterData
    const { mask } = tile

    const texture = context.buildTexture(image, size)
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
    const { featureGuides } = rasterData
    // for each layer that maches the source, build the feature
    const features: RasterFeatureSpec[] = []

    for (const { code, layerIndex } of featureGuides) {
      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue

      const rasterFadeBuffer = context.buildGPUBuffer('Raster Uniform Buffer', new Float32Array([1]), GPUBufferUsage.UNIFORM)
      const featureCodeBuffer = context.buildGPUBuffer('Feature Code Buffer', new Float32Array(code.length > 0 ? code : [0]), GPUBufferUsage.STORAGE)
      const feature = new RasterFeature(
        layerGuide, this, tile, source,
        code, rasterFadeBuffer, featureCodeBuffer
      )
      features.push(feature)
    }

    tile.addFeatures(features)
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 6: it is recommended to create pipeline asynchronously
  // BEST PRACTICE 7: explicitly define pipeline layouts
  async #getPipeline (): Promise<GPURenderPipeline> {
    const { context } = this
    const { device, format, defaultBlend, projection, sampleCount, frameBindGroupLayout, featureBindGroupLayout } = context

    // prep raster uniforms
    this.rasterBindGroupLayout = context.device.createBindGroupLayout({
      label: 'Raster BindGroupLayout',
      entries: [
        // uniforms
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        // sampler
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        // texture
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }
      ]
    })

    const module = device.createShaderModule({ code: shaderCode })
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.rasterBindGroupLayout]
    })
    const stencilState: GPUStencilFaceState = {
      compare: 'equal',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace'
    }

    return await device.createRenderPipelineAsync({
      label: 'Raster Pipeline',
      layout,
      vertex: {
        module,
        entryPoint: 'vMain',
        buffers: SHADER_BUFFER_LAYOUT
      },
      fragment: {
        module,
        entryPoint: 'fMain',
        targets: [{
          format,
          blend: defaultBlend
        }]
      },
      primitive: {
        topology: 'triangle-strip',
        cullMode: projection === 'S2' ? 'back' : 'front',
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

  draw ({ layerGuide, bindGroup, rasterBindGroup, source }: RasterFeatureSpec): void {
    if (!layerGuide.visible) return
    // get current source data
    const { passEncoder } = this.context
    const { vertexBuffer, indexBuffer, count, offset } = source
    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(this.pipeline)
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setIndexBuffer(indexBuffer, 'uint32')
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setBindGroup(2, rasterBindGroup)
    // draw
    passEncoder.drawIndexed(count, 1, offset, 0, 0)
  }
}
