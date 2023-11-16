/* eslint-env browser */
import shaderCode from '../shaders/line.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'
import { buildDashImage } from 'style/color'

import type { WebGPUContext } from '../context'
import type { LineFeature, LineSource, LineWorkflow as LineWorkflowSpec } from './workflow.spec'
import type {
  LayerDefinitionBase,
  LineLayerDefinition,
  LineLayerStyle,
  LineWorkflowLayerGuide
} from 'style/style.spec'
import type { LineData } from 'workers/worker.spec'
import type { TileGPU as Tile } from 'source/tile.spec'

// TODO:
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

export default class LineWorkflow implements LineWorkflowSpec {
  context: WebGPUContext
  layerGuides = new Map<number, LineWorkflowLayerGuide>()
  pipeline!: GPURenderPipeline
  #shaderModule!: GPUShaderModule
  #pipelineLayout!: GPUPipelineLayout
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    const { device, frameBindGroupLayout, featureBindGroupLayout } = this.context
    this.#shaderModule = device.createShaderModule({ code: shaderCode })
    this.#pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout]
    })
    this.pipeline = await this.#getPipeline()
  }

  // programs helps design the appropriate layer parameters
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: LineLayerStyle): LineLayerDefinition {
    const { source, layerIndex, lch } = layerBase
    // PRE) get layer base
    let {
      interactive, cursor, onlyLines,
      // paint
      color, opacity, width, gapwidth,
      // layout
      cap, join, dasharray
    } = layer
    color = color ?? 'rgba(0, 0, 0, 0)'
    opacity = opacity ?? 1
    width = width ?? 1
    gapwidth = gapwidth ?? 0
    // 1) build definition
    const dashed = Array.isArray(dasharray) && dasharray.length > 0
    interactive = interactive ?? false
    cursor = cursor ?? 'default'
    dasharray = dasharray ?? []
    const layerDefinition: LineLayerDefinition = {
      ...layerBase,
      type: 'line',
      color,
      opacity,
      width,
      gapwidth,
      cap: cap ?? 'butt',
      join: join ?? 'miter',
      dasharray,
      onlyLines: onlyLines ?? false,
      dashed,
      interactive,
      cursor
    }
    // 2) Store layer workflow, building code if webgl2
    const layerCode: number[] = []
    for (const paint of [color, opacity, width, gapwidth]) {
      layerCode.push(...encodeLayerAttribute(paint, lch))
    }
    // if dashed, build a texture
    const { length, image } = buildDashImage(dasharray)
    const dashTexture = length > 0 ? this.context.buildTexture(image, length, 4, true) : undefined
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      dashed,
      dashTexture,
      interactive,
      cursor
    })

    return layerDefinition
  }

  buildSource (fillData: LineData, tile: Tile): void {
    const { context } = this
    const { vertexBuffer, lengthSoFarBuffer, featureGuideBuffer } = fillData
    // prep buffers
    const source: LineSource = {
      type: 'line' as const,
      vertexBuffer: context.buildGPUBuffer('Line Vertex Buffer', new Float32Array(vertexBuffer), GPUBufferUsage.VERTEX),
      lengthSoFarBuffer: context.buildGPUBuffer('Line Index Buffer', new Float32Array(lengthSoFarBuffer), GPUBufferUsage.INDEX)
    }
    // build features
    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer))
  }

  #buildFeatures (source: LineSource, tile: Tile, featureGuideArray: Float32Array): void {
    const { context } = this
    const features: LineFeature[] = []

    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [cap, layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 5)
      i += 5
      // build featureCode
      let featureCode: number[] = [0]
      featureCode = encodingSize > 0
        ? [...featureGuideArray.slice(i, i + encodingSize)]
        : [0]
      // update index
      i += encodingSize

      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      const { sourceName, layerCode, lch, dashed, dashTexture, interactive } = layerGuide

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
        type: 'line' as const,
        maskLayer: false,
        source,
        tile,
        parent: undefined,
        dashed,
        dashTexture,
        count,
        offset,
        sourceName,
        layerIndex,
        featureCode,
        lch,
        interactive,
        cap,
        bindGroup,
        draw: () => {
          context.setStencilReference(tile.tmpMaskID)
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
  async #getPipeline (): Promise<GPURenderPipeline> {
    const { context } = this
    const { device, format, sampleCount } = context
    const invert = type === 'invert'
    const mask = type === 'mask'
    const maskLine = type === 'mask-fill'

    const stencilState: GPUStencilFaceState = {
      compare: (mask || invert) ? 'always' : 'equal',
      failOp: 'keep',
      depthFailOp: invert ? 'invert' : 'keep',
      passOp: invert ? 'invert' : 'replace'
    }

    return await device.createRenderPipelineAsync({
      layout: this.#pipelineLayout,
      vertex: {
        module: this.#shaderModule,
        entryPoint: 'vMain',
        buffers: SHADER_BUFFER_LAYOUT
      },
      fragment: {
        module: this.#shaderModule,
        entryPoint: 'fMain',
        targets: [{ format, writeMask: (mask || invert) ? 0 : GPUColorWrite.ALL }]
      },
      primitive: {
        topology: (mask || maskLine) ? 'triangle-strip' : 'triangle-list',
        cullMode: 'back',
        stripIndexFormat: (mask || maskLine) ? 'uint32' : undefined
      },
      multisample: { count: sampleCount },
      depthStencil: {
        depthWriteEnabled: !mask,
        depthCompare: mask ? 'always' : 'less',
        format: 'depth24plus-stencil8',
        stencilFront: stencilState,
        stencilBack: stencilState,
        stencilReadMask: 0xFFFFFFFF,
        stencilWriteMask: 0xFFFFFFFF
      }
    })
  }

  draw (featureGuide: LineFeature): void {
    // get current source data
    const { passEncoder } = this.context
    const { invert, bindGroup, source, count, offset } = featureGuide
    const { vertexBuffer, lengthSoFarBuffer } = source

    // setup pipeline, bind groups, & buffers
    passEncoder.setPipeline(this.pipeline)
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setVertexBuffer(1, lengthSoFarBuffer)
    // draw
    passEncoder.drawIndexed(count, 1, offset, 0, 0)
  }
}
