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
  texturePipeline!: GPURenderPipeline
  #hillshadeRenderTargetBindGroupLayout!: GPUBindGroupLayout
  #hillshadeFeatureBindGroupLayout!: GPUBindGroupLayout
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    const { context } = this
    const { device } = context
    // prep hillshade uniforms
    this.#hillshadeFeatureBindGroupLayout = context.device.createBindGroupLayout({
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
    this.#hillshadeRenderTargetBindGroupLayout = context.device.createBindGroupLayout({
      label: 'Hillshade BindGroupLayout',
      entries: [
        // float texture
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } }
      ]
    })
    this.module = device.createShaderModule({ code: shaderCode })
    // create pipelines
    this.pipeline = this.#getPipeline('screen')
    this.texturePipeline = this.#getPipeline('texture')
  }

  resize (): void {
    for (const layerGuide of this.layerGuides.values()) {
      if (layerGuide.renderTarget !== undefined) layerGuide.renderTarget.destroy()
      layerGuide.renderTarget = this.#buildLayerRenderTarget()
      // setup render pass descriptor
      layerGuide.renderPassDescriptor = this.#buildLayerPassDescriptor(layerGuide.renderTarget)
      // set up bind group
      layerGuide.textureBindGroup = this.#buildLayerBindGroup(layerGuide.renderTarget)
    }
  }

  destroy (): void {
    for (const { layerBuffer, layerCodeBuffer, renderTarget } of this.layerGuides.values()) {
      layerBuffer.destroy()
      layerCodeBuffer.destroy()
      renderTarget.destroy()
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
    const renderTarget = this.#buildLayerRenderTarget()
    // 4) Store layer guide
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      fadeDuration: fadeDuration ?? 300,
      layerBuffer,
      layerCodeBuffer,
      renderTarget,
      renderPassDescriptor: this.#buildLayerPassDescriptor(renderTarget),
      textureBindGroup: this.#buildLayerBindGroup(renderTarget)
    })

    return layerDefinition
  }

  buildSource (hillshadeData: HillshadeData, tile: Tile): void {
    const { context } = this
    const { image, built, size } = hillshadeData
    const { mask } = tile

    const isOverSized = size % 256 !== 0
    const properSize = isOverSized ? size - 2 : size
    const texture = context.buildTexture(
      built ? image as ImageBitmap : new Uint8ClampedArray(image as ArrayBuffer),
      properSize,
      properSize,
      1,
      isOverSized ? { x: 1, y: 1 } : undefined
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

      // TODO: support hillshadeFadeBuffer
      const hillshadeFadeBuffer = context.buildGPUBuffer('Hillshade Uniform Buffer', new Float32Array([1]), GPUBufferUsage.UNIFORM)
      const hillshadeBindGroup = context.device.createBindGroup({
        label: 'Hillshade BindGroup',
        layout: this.#hillshadeFeatureBindGroupLayout,
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

  #buildLayerRenderTarget (): GPUTexture {
    const { device, presentation } = this.context
    return device.createTexture({
      size: presentation,
      format: 'r32float',
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

  #buildLayerBindGroup (renderTarget: GPUTexture): GPUBindGroup {
    return this.context.device.createBindGroup({
      layout: this.#hillshadeRenderTargetBindGroupLayout,
      entries: [
        { binding: 0, resource: renderTarget.createView() }
      ]
    })
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 6: it is recommended to create pipeline asynchronously
  // BEST PRACTICE 7: explicitly define pipeline layouts
  #getPipeline (type: 'texture' | 'screen'): GPURenderPipeline {
    const { context, module } = this
    const { device, format, defaultBlend, projection, sampleCount, frameBindGroupLayout, featureBindGroupLayout } = context
    const isScreen = type === 'screen'

    const layout = isScreen
      ? device.createPipelineLayout({
        bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.#hillshadeFeatureBindGroupLayout, this.#hillshadeRenderTargetBindGroupLayout]
      })
      : device.createPipelineLayout({
        bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.#hillshadeFeatureBindGroupLayout]
      })
    const stencilState: GPUStencilFaceState = {
      compare: isScreen ? 'equal' : 'always',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace'
    }

    return device.createRenderPipeline({
      label: `Hillshade ${type} Pipeline`,
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
          format: isScreen ? format : 'r32float',
          blend: isScreen ? defaultBlend : undefined
        }]
      },
      primitive: {
        topology: 'triangle-strip',
        cullMode: isScreen ? 'none' : projection === 'S2' ? 'back' : 'front',
        stripIndexFormat: 'uint32'
      },
      multisample: { count: sampleCount },
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

  textureDraw (features: HillshadeFeature[]): HillshadeFeature[] | undefined {
    if (features.length === 0) return undefined
    const { context } = this
    const { device, frameBufferBindGroup } = context

    const output: HillshadeFeature[] = []
    // group by layerIndex
    const layerFeatures = new Map<number, HillshadeFeature[]>()
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
      for (const { bindGroup, hillshadeBindGroup, source } of features) {
        const { vertexBuffer, indexBuffer, count, offset } = source
        // setup pipeline, bind groups, & buffers
        passEncoder.setBindGroup(1, bindGroup)
        passEncoder.setBindGroup(2, hillshadeBindGroup)
        passEncoder.setVertexBuffer(0, vertexBuffer)
        passEncoder.setIndexBuffer(indexBuffer, 'uint32')
        // draw
        passEncoder.drawIndexed(count, 1, offset, 0, 0)
      }
      // finish
      passEncoder.end()
      device.queue.submit([commandEncoder.finish()])
    }

    return output
  }

  draw ({ bindGroup, hillshadeBindGroup, layerIndex }: HillshadeFeature): void {
    // get current source data
    const { passEncoder } = this.context
    const layerGuide = this.layerGuides.get(layerIndex)
    if (layerGuide === undefined) return
    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(this.pipeline)
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setBindGroup(2, hillshadeBindGroup)
    passEncoder.setBindGroup(3, layerGuide.textureBindGroup)
    // draw a screen quad
    passEncoder.draw(6)
  }
}
