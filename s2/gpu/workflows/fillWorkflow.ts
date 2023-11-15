/* eslint-env browser */
import shaderCode from '../shaders/fill.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type { WebGPUContext } from '../context'
import type { FillFeature, FillSource, FillWorkflow as FillWorkflowSpec, MaskSource } from './workflow.spec'
import type {
  FillLayerDefinition,
  FillLayerStyle,
  FillWorkflowLayerGuide,
  LayerDefinitionBase,
  LayerStyle
} from 'style/style.spec'
import type { FillData } from 'workers/worker.spec'
import type { TileGPU as Tile } from 'source/tile.spec'

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout | null> = [
  { // position
    arrayStride: 4 * 2,
    attributes: [{
      shaderLocation: 0,
      offset: 0,
      format: 'float32x2'
    }]
  },
  { // id
    arrayStride: 4,
    attributes: [{
      shaderLocation: 1,
      offset: 0,
      format: 'uint32'
    }]
  },
  { // code
    arrayStride: 4,
    attributes: [{
      shaderLocation: 2,
      offset: 0,
      format: 'uint32'
    }]
  }
]

export default class FillWorkflow implements FillWorkflowSpec {
  context: WebGPUContext
  layerGuides = new Map<number, FillWorkflowLayerGuide>()
  maskPipeline!: GPURenderPipeline
  fillPipeline!: GPURenderPipeline
  invertPipeline!: GPURenderPipeline
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    this.maskPipeline = await this.#getPipeline('mask')
    this.fillPipeline = await this.#getPipeline('fill')
    this.invertPipeline = await this.#getPipeline('invert')
  }

  // programs helps design the appropriate layer parameters
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: LayerStyle): FillLayerDefinition {
    const { source, layerIndex, lch } = layerBase
    // PRE) get layer base
    let { color, opacity, invert, opaque, interactive, cursor } = layer as FillLayerStyle
    invert = invert ?? false
    opaque = opaque ?? false
    interactive = interactive ?? false
    cursor = cursor ?? 'default'
    // 1) build definition
    color = color ?? 'rgb(0, 0, 0)'
    opacity = opacity ?? 1
    const layerDefinition: FillLayerDefinition = {
      ...layerBase,
      type: 'fill',
      // paint
      color,
      opacity,
      // propreties
      invert,
      interactive,
      opaque,
      cursor
    }
    // 2) Store layer workflow, building code if webgl2
    const layerCode: number[] = []
    for (const paint of [color, opacity]) {
      layerCode.push(...encodeLayerAttribute(paint, lch))
    }
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      invert,
      opaque,
      interactive
    })

    return layerDefinition
  }

  // given a set of layerIndexes that use Masks and the tile of interest
  async buildMaskFeature ({ layerIndex, minzoom, maxzoom }: FillLayerDefinition, tile: Tile): Promise<void> {
    const { context } = this
    const { zoom, mask } = tile
    // not in the zoom range, ignore
    if (zoom < minzoom || zoom > maxzoom) return

    const layer = this.layerGuides.get(layerIndex)
    if (layer === undefined) return
    const { sourceName, layerCode, lch, invert, opaque, interactive } = layer
    const tileBuffer = context.buildStaticGPUBuffer('Tile Uniform Buffer', 'float', tile.uniforms, GPUBufferUsage.UNIFORM)
    const layerBuffer = context.buildStaticGPUBuffer('Layer Uniform Buffer', 'float', new Float32Array([context.getDepthPosition(layerIndex), lch ? 1 : 0]), GPUBufferUsage.UNIFORM)
    const layerCodeBuffer = context.buildStaticGPUBuffer('Layer Code Buffer', 'uint', new Uint32Array([...layerCode, ...Array(128 - layerCode.length).fill(0)]), GPUBufferUsage.STORAGE)
    const featureCodeBuffer = context.buildStaticGPUBuffer('Feature Code Buffer', 'float', new Float32Array(64), GPUBufferUsage.STORAGE)
    const bindGroup = context.buildGroup(
      'Feature BindGroup',
      context.featureBindGroupLayout,
      [tileBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
    )
    const feature: FillFeature = {
      type: 'fill' as const,
      sourceName,
      maskLayer: true,
      source: mask,
      count: mask.count,
      offset: mask.offset,
      tile,
      layerIndex,
      lch,
      invert,
      opaque,
      interactive,
      featureCode: [0],
      bindGroup,
      draw: () => { this.draw(feature) }
    }
    tile.addFeatures([feature])
  }

  async buildSource (fillData: FillData, tile: Tile): Promise<void> {
    const { context } = this
    const { vertexBuffer, indexBuffer, fillIDBuffer, codeTypeBuffer, featureGuideBuffer } = fillData
    // prep buffers
    const source: FillSource = {
      type: 'fill',
      vertexBuffer: context.buildGPUBuffer('Fill Vertex Buffer', new Float32Array(vertexBuffer), GPUBufferUsage.VERTEX),
      indexBuffer: context.buildGPUBuffer('Fill Index Buffer', new Uint32Array(indexBuffer), GPUBufferUsage.INDEX),
      fillIDBuffer: context.buildGPUBuffer('Fill ID Buffer', new Uint32Array(fillIDBuffer), GPUBufferUsage.VERTEX),
      codeTypeBuffer: context.buildGPUBuffer('Fill Code Type Buffer', new Uint32Array(codeTypeBuffer), GPUBufferUsage.VERTEX)
    }
    // build features
    await this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer))
  }

  async #buildFeatures (source: FillSource, tile: Tile, featureGuideArray: Float32Array): Promise<void> {
    const { context } = this
    const features: FillFeature[] = []

    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4)
      i += 4
      // If webgl1, we pull out the color and opacity otherwise build featureCode
      let featureCode: number[] = [0]
      if (encodingSize > 0) featureCode = [...featureGuideArray.slice(i, i + encodingSize)]
      // update index
      i += encodingSize

      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      const { sourceName, layerCode, lch, invert, opaque, interactive } = layerGuide

      // TODO: we need to create two features if interactive is true.

      const tileBuffer = context.buildStaticGPUBuffer('Tile Uniform Buffer', 'float', tile.uniforms, GPUBufferUsage.UNIFORM)
      const layerBuffer = context.buildStaticGPUBuffer('Layer Uniform Buffer', 'float', new Float32Array([context.getDepthPosition(layerIndex), lch ? 1 : 0]), GPUBufferUsage.UNIFORM)
      const layerCodeBuffer = context.buildStaticGPUBuffer('Layer Code Buffer', 'float', new Float32Array([...layerCode, ...Array(128 - layerCode.length).fill(0)]), GPUBufferUsage.STORAGE)
      const featureCodeBuffer = context.buildStaticGPUBuffer('Feature Code Buffer', 'float', new Float32Array([...featureCode, ...Array(64 - featureCode.length).fill(0)]), GPUBufferUsage.STORAGE)
      const bindGroup = context.buildGroup(
        'Feature BindGroup',
        context.featureBindGroupLayout,
        [tileBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
      )

      const feature = {
        type: 'fill' as const,
        maskLayer: false,
        source,
        tile,
        parent: undefined,
        count,
        offset,
        sourceName,
        invert,
        layerIndex,
        opaque,
        featureCode,
        lch,
        interactive,
        bindGroup,
        draw: () => {
          context.setStencilReference((feature.parent ?? feature.tile).tmpMaskID)
          this.draw(feature)
        }
      }
      features.push(feature)
    }

    tile.addFeatures(features)
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 6: it is recommended to create pipeline asynchronously
  // BEST PRACTICE 7: explicitly define pipeline layouts
  async #getPipeline (type: 'fill' | 'mask' | 'invert'): Promise<GPURenderPipeline> {
    const { context } = this
    const { device, format, frameBindGroupLayout, featureBindGroupLayout } = context
    const invert = type === 'invert'
    const mask = type === 'mask'

    const stencilState: GPUStencilFaceState = invert
      ? { compare: 'always', failOp: 'keep', depthFailOp: 'invert', passOp: 'invert' }
      : { compare: 'always', failOp: 'keep', depthFailOp: 'keep', passOp: 'replace' }

    return await device.createRenderPipelineAsync({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout]
      }),
      vertex: {
        module: device.createShaderModule({ code: shaderCode }),
        entryPoint: 'vMain',
        buffers: SHADER_BUFFER_LAYOUT
      },
      fragment: {
        module: device.createShaderModule({ code: shaderCode }),
        entryPoint: 'fMain',
        targets: [{ format, writeMask: invert ? 0 : GPUColorWrite.ALL }]
      },
      primitive: { topology: mask ? 'triangle-strip' : 'triangle-list', cullMode: 'back' },
      depthStencil: mask
        ? {
            depthWriteEnabled: false,
            depthCompare: 'always',
            format: 'stencil8',
            stencilFront: stencilState,
            stencilBack: stencilState,
            stencilReadMask: 0xFFFFFFFF,
            stencilWriteMask: 0xFFFFFFFF
          }
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

  draw (featureGuide: FillFeature): void {
    // get current source data
    const { passEncoder } = this.context
    const { bindGroup, invert, source, count, offset } = featureGuide
    const { type, vertexBuffer, indexBuffer } = source
    const pipeline = invert ? this.invertPipeline : type === 'mask' ? this.maskPipeline : this.fillPipeline

    passEncoder.setPipeline(pipeline)
    // seup bind groups
    passEncoder.setBindGroup(1, bindGroup)
    // setup buffers
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setIndexBuffer(indexBuffer, 'uint32')
    if (type === 'fill') {
      passEncoder.setVertexBuffer(1, source.fillIDBuffer)
      passEncoder.setVertexBuffer(2, source.codeTypeBuffer)
    }
    // draw
    passEncoder.drawIndexed(count, 1, offset, 0, 0)
    // TODO: If invert, we need to draw the mask after
  }

  drawMask (maskSource: MaskSource): void {
    // get current source data
    const { passEncoder } = this.context
    const { vertexBuffer, indexBuffer, count, offset } = maskSource

    passEncoder.setPipeline(this.maskPipeline)
    // setup buffers
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setIndexBuffer(indexBuffer, 'uint32')
    // draw
    passEncoder.drawIndexed(count, 1, offset, 0, 0)
  }
}
