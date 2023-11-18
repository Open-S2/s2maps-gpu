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
  LineWorkflowLayerGuideGPU
} from 'style/style.spec'
import type { LineData } from 'workers/worker.spec'
import type { TileGPU as Tile } from 'source/tile.spec'

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  { // type
    arrayStride: 4,
    attributes: [{
      shaderLocation: 0,
      offset: 0,
      format: 'float32'
    }]
  },
  { // prev
    arrayStride: 6 * 4, // 6 elements of 4 bytes
    stepMode: 'instance',
    attributes: [{
      shaderLocation: 1,
      offset: 0,
      format: 'float32x2'
    }]
  },
  { // curr
    arrayStride: 6 * 4, // 6 elements of 4 bytes
    stepMode: 'instance',
    attributes: [{
      shaderLocation: 2,
      offset: 8,
      format: 'float32x2'
    }]
  },
  { // next
    arrayStride: 6 * 4, // 6 elements of 4 bytes
    stepMode: 'instance',
    attributes: [{
      shaderLocation: 3,
      offset: 16,
      format: 'float32x2'
    }]
  }
  // { // lengthSoFar
  //   arrayStride: 4,
  //   stepMode: 'instance',
  //   attributes: [{
  //     shaderLocation: 4,
  //     offset: 0,
  //     format: 'float32'
  //   }]
  // }
]

export default class LineWorkflow implements LineWorkflowSpec {
  context: WebGPUContext
  layerGuides = new Map<number, LineWorkflowLayerGuideGPU>()
  pipeline!: GPURenderPipeline
  curTexture = -1
  #typeBuffer?: GPUBuffer
  #lineBindGroupLayout!: GPUBindGroupLayout
  nullTexture!: GPUTexture
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    this.pipeline = await this.#getPipeline()
    this.nullTexture = this.context.buildTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
  }

  // programs helps design the appropriate layer parameters
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: LineLayerStyle): LineLayerDefinition {
    const { context } = this
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
    // 2) build the layerCode
    const layerCode: number[] = []
    for (const paint of [color, opacity]) {
      layerCode.push(...encodeLayerAttribute(paint, lch))
    }
    // 3) Setup layer buffers in GPU
    const layerBuffer = context.buildStaticGPUBuffer('Layer Uniform Buffer', 'float', [context.getDepthPosition(layerIndex), ~~lch], GPUBufferUsage.UNIFORM)
    const layerCodeBuffer = context.buildStaticGPUBuffer('Layer Code Buffer', 'float', [...layerCode, ...Array(128 - layerCode.length).fill(0)], GPUBufferUsage.STORAGE)
    // if dashed, build a texture
    const { length, image } = buildDashImage(dasharray)
    const dashTexture = length > 0 ? this.context.buildTexture(image, length, 4) : undefined
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      layerBuffer,
      layerCodeBuffer,
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
      typeBuffer: this.#getTypeBuffer(),
      vertexBuffer: context.buildGPUBuffer('Line Vertex Buffer', new Float32Array(vertexBuffer), GPUBufferUsage.VERTEX),
      lengthSoFarBuffer: context.buildGPUBuffer('Line LengthSoFar Buffer', new Float32Array(lengthSoFarBuffer), GPUBufferUsage.VERTEX)
    }
    // build features
    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer))
  }

  #getTypeBuffer (): GPUBuffer {
    const { context } = this

    if (this.#typeBuffer === undefined) {
      // 0 -> curr
      // 1 -> curr + (-1 * normal)
      // 2 -> curr + (normal)
      // 3 -> next + (-1 * normal)
      // 4 -> next + (normal)
      // 5 -> curr + (normal) [check that prev, curr, and next is CCW otherwise invert normal]
      // 6 -> curr + (previous-normal) [check that prev, curr, and next is CCW otherwise invert normal]
      const typeArray = new Float32Array([1, 3, 4, 1, 4, 2, 0, 5, 6])
      this.#typeBuffer = context.buildGPUBuffer('Line Type Buffer', typeArray, GPUBufferUsage.VERTEX)
    }

    return this.#typeBuffer
  }

  #buildFeatures (source: LineSource, tile: Tile, featureGuideArray: Float32Array): void {
    const { context } = this
    const { mask } = tile
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
      const { sourceName, layerBuffer, layerCodeBuffer, lch, dashed, dashTexture, interactive } = layerGuide

      const lineUniformBuffer = context.buildStaticGPUBuffer('Line Uniform Buffer', 'float', [cap, ~~dashed], GPUBufferUsage.UNIFORM)
      const lineBindGroup = context.buildGroup(
        'Line BindGroup',
        this.#lineBindGroupLayout,
        [lineUniformBuffer]
      )

      const featureCodeBuffer = context.buildStaticGPUBuffer('Feature Code Buffer', 'float', [...featureCode, ...Array(64 - featureCode.length).fill(0)], GPUBufferUsage.STORAGE)
      const bindGroup = context.buildGroup(
        'Feature BindGroup',
        context.featureBindGroupLayout,
        [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
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
        lineBindGroup,
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
    const { device, format, sampleCount, frameBindGroupLayout, featureBindGroupLayout } = context

    // prep line uniforms
    this.#lineBindGroupLayout = context.buildLayout('Line', ['uniform'], GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT)

    const module = device.createShaderModule({ code: shaderCode })
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.#lineBindGroupLayout]
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
        topology: 'triangle-list',
        cullMode: 'back'
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

  draw (featureGuide: LineFeature): void {
    // get current source data
    const { passEncoder } = this.context
    const { bindGroup, lineBindGroup, source, count, offset } = featureGuide
    const { vertexBuffer } = source
    const vByteOffset = offset * 24

    // setup pipeline, bind groups, & buffers
    passEncoder.setPipeline(this.pipeline)
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setBindGroup(2, lineBindGroup)
    passEncoder.setVertexBuffer(0, this.#getTypeBuffer())
    passEncoder.setVertexBuffer(1, vertexBuffer, vByteOffset) // prev
    passEncoder.setVertexBuffer(2, vertexBuffer, vByteOffset) // curr
    passEncoder.setVertexBuffer(3, vertexBuffer, vByteOffset) // next
    // passEncoder.setVertexBuffer(4, lengthSoFarBuffer, offset * 4)
    // draw
    passEncoder.draw(9, count)
  }
}
