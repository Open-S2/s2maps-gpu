/* eslint-env browser */
import shaderCode from '../shaders/hillshade.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type { WebGPUContext } from '../context'
import type { HillshadeFeature, HillshadeWorkflow as HillshadeWorkflowSpec, RasterSource } from './workflow.spec'
import type {
  HillshadeLayerDefinition,
  HillshadeLayerStyle,
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

export default class HillshadeWorkflow implements HillshadeWorkflowSpec {
  context: WebGPUContext
  layerGuides = new Map<number, HillshadeWorkflowLayerGuideGPU>()
  module!: GPUShaderModule
  pipeline!: GPURenderPipeline
  #hillshadeBindGroupLayout!: GPUBindGroupLayout
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    const { context } = this
    const { device } = context
    // prep hillshade uniforms
    this.#hillshadeBindGroupLayout = context.device.createBindGroupLayout({
      label: 'Hillshade Texture BindGroupLayout',
      entries: [
        // uniform
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        // sampler
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        // texture
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }
      ]
    })
    this.module = device.createShaderModule({ code: shaderCode })
    // create pipelines
    this.pipeline = await this.#getPipeline()
  }

  destroy (): void {
    for (const { layerBuffer, layerCodeBuffer } of this.layerGuides.values()) {
      layerBuffer.destroy()
      layerCodeBuffer.destroy()
    }
  }

  // programs helps design the appropriate layer parameters
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: HillshadeLayerStyle): HillshadeLayerDefinition {
    const { context } = this
    const { source, layerIndex, lch } = layerBase
    // PRE) get layer properties
    let { shadowColor, accentColor, highlightColor, opacity, azimuth, altitude, fadeDuration } = layer
    shadowColor = shadowColor ?? '#000'
    accentColor = accentColor ?? '#000'
    highlightColor = highlightColor ?? '#fff'
    opacity = opacity ?? 1
    azimuth = azimuth ?? 315
    altitude = altitude ?? 45
    fadeDuration = fadeDuration ?? 300
    // 1) build definition
    const layerDefinition: HillshadeLayerDefinition = {
      ...layerBase,
      type: 'hillshade',
      shadowColor,
      accentColor,
      highlightColor,
      azimuth,
      altitude,
      opacity
    }
    // 2) Store layer workflow
    const layerCode: number[] = []
    for (const paint of [opacity, shadowColor, accentColor, highlightColor, azimuth, altitude]) {
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
      layerBuffer,
      layerCodeBuffer
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
    const { sourceName, featureGuides } = hillshadeData
    const { mask } = tile
    // for each layer that maches the source, build the feature

    const features: HillshadeFeature[] = []

    for (const { code, layerIndex } of featureGuides) {
      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      const { layerBuffer, layerCodeBuffer, fadeDuration, lch } = layerGuide

      const hillshadeFadeBuffer = context.buildGPUBuffer('Hillshade Uniform Buffer', new Float32Array([1]), GPUBufferUsage.UNIFORM)
      const hillshadeBindGroup = context.device.createBindGroup({
        label: 'Hillshade BindGroup',
        layout: this.#hillshadeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: hillshadeFadeBuffer } },
          { binding: 1, resource: context.defaultSampler },
          { binding: 2, resource: source.texture.createView() }
        ]
      })
      const featureCodeBuffer = context.buildGPUBuffer('Feature Code Buffer', new Float32Array(code.length > 0 ? code : [0]), GPUBufferUsage.STORAGE)
      const bindGroup = context.buildGroup(
        'Feature BindGroup',
        context.featureBindGroupLayout,
        [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
      )

      const feature: HillshadeFeature = {
        type: 'hillshade' as const,
        tile,
        source,
        sourceName,
        layerIndex,
        lch,
        featureCode: code,
        fadeDuration,
        bindGroup,
        hillshadeBindGroup,
        fadeStartTime: Date.now(),
        draw: () => {
          context.setStencilReference(tile.tmpMaskID)
          this.draw(feature)
        },
        destroy: () => {
          hillshadeFadeBuffer.destroy()
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
    const { context, module } = this
    const { device, format, defaultBlend, projection, sampleCount, frameBindGroupLayout, featureBindGroupLayout } = context

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.#hillshadeBindGroupLayout]
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

  draw ({ bindGroup, hillshadeBindGroup, source }: HillshadeFeature): void {
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
