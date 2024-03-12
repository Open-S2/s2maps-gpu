import shaderCode from '../shaders/hillshade.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type { WebGPUContext } from '../context'
import type {
  HillshadeFeature as HillshadeFeatureSpec,
  HillshadeWorkflow as HillshadeWorkflowSpec,
  RasterSource
} from './workflow.spec'
import type {
  HillshadeDefinition,
  HillshadeStyle,
  HillshadeWorkflowLayerGuideGPU,
  LayerDefinitionBase
} from 'style/style.spec'
import type { HillshadeData } from 'workers/worker.spec'
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

export class HilllshadeFeature implements HillshadeFeatureSpec {
  type = 'hillshade' as const
  sourceName: string
  fadeDuration: number
  bindGroup: GPUBindGroup
  hillshadeBindGroup: GPUBindGroup
  constructor (
    public layerGuide: HillshadeWorkflowLayerGuideGPU,
    public workflow: HillshadeWorkflowSpec,
    public tile: Tile,
    public source: RasterSource,
    public featureCode: number[],
    public hillshadeFadeBuffer: GPUBuffer,
    public featureCodeBuffer: GPUBuffer,
    public fadeStartTime = Date.now(),
    public parent?: Tile
  ) {
    const { sourceName, fadeDuration } = layerGuide
    this.sourceName = sourceName
    this.fadeDuration = fadeDuration
    this.bindGroup = this.#buildBindGroup()
    this.hillshadeBindGroup = this.#buildHillshadeBindGroup()
  }

  draw (): void {
    const { tile, workflow } = this
    workflow.context.setStencilReference(tile.tmpMaskID)
    workflow.draw(this)
  }

  destroy (): void {
    const { hillshadeFadeBuffer, featureCodeBuffer } = this
    hillshadeFadeBuffer.destroy()
    featureCodeBuffer.destroy()
  }

  duplicate (tile: Tile, parent: Tile): HilllshadeFeature {
    const {
      layerGuide, workflow, source,
      featureCode, hillshadeFadeBuffer, featureCodeBuffer, fadeStartTime
    } = this
    const { context } = workflow
    const cE = context.device.createCommandEncoder()
    const newHillshadeFadeBuffer = context.duplicateGPUBuffer(hillshadeFadeBuffer, cE)
    const newFeatureCodeBuffer = context.duplicateGPUBuffer(featureCodeBuffer, cE)
    context.device.queue.submit([cE.finish()])
    return new HilllshadeFeature(
      layerGuide, workflow, tile, source, featureCode,
      newHillshadeFadeBuffer, newFeatureCodeBuffer, fadeStartTime, parent
    )
  }

  #buildBindGroup (): GPUBindGroup {
    const { workflow, tile, parent, layerGuide, featureCodeBuffer } = this
    const { context } = workflow
    const { mask } = parent ?? tile
    const { layerBuffer, layerCodeBuffer } = layerGuide
    return context.buildGroup(
      'Hillshade Feature BindGroup',
      context.featureBindGroupLayout,
      [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
    )
  }

  #buildHillshadeBindGroup (): GPUBindGroup {
    const { source, workflow, hillshadeFadeBuffer, layerGuide } = this
    const { context, hillshadeBindGroupLayout } = workflow
    const { unpackBuffer } = layerGuide
    return context.device.createBindGroup({
      label: 'Hillshade BindGroup',
      layout: hillshadeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: hillshadeFadeBuffer } },
        { binding: 1, resource: context.defaultSampler },
        { binding: 2, resource: source.texture.createView() },
        { binding: 3, resource: { buffer: unpackBuffer } }
      ]
    })
  }
}

export default class HillshadeWorkflow implements HillshadeWorkflowSpec {
  context: WebGPUContext
  layerGuides = new Map<number, HillshadeWorkflowLayerGuideGPU>()
  pipeline!: GPURenderPipeline
  hillshadeBindGroupLayout!: GPUBindGroupLayout
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    // create pipelines
    this.pipeline = await this.#getPipeline()
  }

  destroy (): void {
    for (const { layerBuffer, layerCodeBuffer, unpackBuffer } of this.layerGuides.values()) {
      layerBuffer.destroy()
      layerCodeBuffer.destroy()
      unpackBuffer.destroy()
    }
  }

  // programs helps design the appropriate layer parameters
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: HillshadeStyle): HillshadeDefinition {
    const { context } = this
    const { source, layerIndex, lch, visible } = layerBase
    // PRE) get layer properties
    let { unpack, shadowColor, accentColor, highlightColor, opacity, azimuth, altitude, fadeDuration } = layer
    shadowColor = shadowColor ?? '#000'
    accentColor = accentColor ?? '#000'
    highlightColor = highlightColor ?? '#fff'
    opacity = opacity ?? 1
    azimuth = azimuth ?? 315
    altitude = altitude ?? 45
    fadeDuration = fadeDuration ?? 300
    // defaults to mapbox unpack
    unpack = unpack ?? { offset: -10000, zFactor: 0.1, aMultiplier: 0, bMultiplier: 1, gMultiplier: 256, rMultiplier: 256 * 256 }
    // 1) build definition
    const layerDefinition: HillshadeDefinition = {
      ...layerBase,
      type: 'hillshade',
      // paint
      shadowColor,
      accentColor,
      highlightColor,
      azimuth,
      altitude,
      opacity,
      // layout
      unpack
    }
    // 2) Store layer workflow
    const layerCode: number[] = []
    for (const paint of [opacity, shadowColor, accentColor, highlightColor, azimuth, altitude]) {
      layerCode.push(...encodeLayerAttribute(paint, lch))
    }
    // 3) Setup layer buffers in GPU
    const layerBuffer = context.buildGPUBuffer('Layer Uniform Buffer', new Float32Array([context.getDepthPosition(layerIndex), ~~lch]), GPUBufferUsage.UNIFORM)
    const layerCodeBuffer = context.buildGPUBuffer('Layer Code Buffer', new Float32Array(layerCode), GPUBufferUsage.STORAGE)
    const unpackData = [unpack.offset, unpack.zFactor, unpack.rMultiplier, unpack.gMultiplier, unpack.bMultiplier, unpack.aMultiplier]
    const unpackBuffer = context.buildGPUBuffer('Unpack Buffer', new Float32Array(unpackData), GPUBufferUsage.UNIFORM)
    // 4) Store layer guide
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      fadeDuration: fadeDuration ?? 300,
      layerBuffer,
      layerCodeBuffer,
      unpackBuffer,
      visible
    })

    return layerDefinition
  }

  buildSource (hillshadeData: HillshadeData, tile: Tile): void {
    const { context } = this
    const { image, built, size } = hillshadeData
    const { mask } = tile

    const texture = context.buildTexture(
      built ? image as ImageBitmap : new Uint8ClampedArray(image as ArrayBuffer),
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
    this.#buildFeatures(source, hillshadeData, tile)
  }

  #buildFeatures (source: RasterSource, hillshadeData: HillshadeData, tile: Tile): void {
    const { context } = this
    const { featureGuides } = hillshadeData
    // for each layer that maches the source, build the feature
    const features: HillshadeFeatureSpec[] = []

    for (const { code, layerIndex } of featureGuides) {
      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue

      const hillshadeFadeBuffer = context.buildGPUBuffer('Hillshade Uniform Buffer', new Float32Array([1]), GPUBufferUsage.UNIFORM)
      const featureCodeBuffer = context.buildGPUBuffer('Feature Code Buffer', new Float32Array(code.length > 0 ? code : [0]), GPUBufferUsage.STORAGE)
      const feature = new HilllshadeFeature(
        layerGuide, this, tile, source,
        code, hillshadeFadeBuffer, featureCodeBuffer
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

    // prep hillshade uniforms
    this.hillshadeBindGroupLayout = context.device.createBindGroupLayout({
      label: 'Hillshade BindGroupLayout',
      entries: [
        // uniform
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        // sampler
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        // texture
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        // unpack
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
      ]
    })

    const module = device.createShaderModule({ code: shaderCode })
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.hillshadeBindGroupLayout]
    })
    const stencilState: GPUStencilFaceState = {
      compare: 'equal',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace'
    }

    return await device.createRenderPipelineAsync({
      label: 'Hillshade Pipeline',
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

  draw ({ layerGuide, bindGroup, hillshadeBindGroup, source }: HillshadeFeatureSpec): void {
    if (!layerGuide.visible) return
    // get current source data
    const { passEncoder } = this.context
    const { vertexBuffer, indexBuffer, count, offset } = source
    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(this.pipeline)
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setIndexBuffer(indexBuffer, 'uint32')
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setBindGroup(2, hillshadeBindGroup)
    // draw
    passEncoder.drawIndexed(count, 1, offset, 0, 0)
  }
}
