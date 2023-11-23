/* eslint-env browser */
import shaderCode from '../shaders/point.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type { WebGPUContext } from '../context'
import type { PointFeature, PointSource, PointWorkflow as PointWorkflowSpec } from './workflow.spec'
import type {
  LayerDefinitionBase,
  PointLayerDefinition,
  PointLayerStyle,
  PointWorkflowLayerGuideGPU
} from 'style/style.spec'
import type { PointData } from 'workers/worker.spec'
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
  }
]

export default class PointWorkflow implements PointWorkflowSpec {
  context: WebGPUContext
  layerGuides = new Map<number, PointWorkflowLayerGuideGPU>()
  pipeline!: GPURenderPipeline
  #pointBindGroupLayout!: GPUBindGroupLayout
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
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: PointLayerStyle): PointLayerDefinition {
    const { context } = this
    const { source, layerIndex, lch } = layerBase
    // PRE) get layer base
    let { radius, opacity, color, stroke, strokeWidth, interactive, cursor } = layer
    radius = radius ?? 1
    opacity = opacity ?? 1
    color = color ?? 'rgba(0, 0, 0, 0)'
    stroke = stroke ?? 'rgba(0, 0, 0, 0)'
    strokeWidth = strokeWidth ?? 1
    interactive = interactive ?? false
    cursor = cursor ?? 'default'
    // 1) build definition
    const layerDefinition: PointLayerDefinition = {
      ...layerBase,
      type: 'point' as const,
      // paint
      radius,
      opacity,
      color,
      stroke,
      strokeWidth,
      // propreties
      interactive,
      cursor
    }
    // 2) build the layerCode
    const layerCode: number[] = []
    for (const paint of [radius, strokeWidth, opacity, color, stroke]) {
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
      interactive,
      cursor
    })

    return layerDefinition
  }

  buildSource (pointData: PointData, tile: Tile): void {
    const { context } = this
    const { vertexBuffer, idBuffer, featureGuideBuffer } = pointData
    // prep buffers
    const source: PointSource = {
      type: 'point' as const,
      vertexBuffer: context.buildGPUBuffer('Point Vertex Buffer', new Float32Array(vertexBuffer), GPUBufferUsage.VERTEX),
      idBuffer: context.buildGPUBuffer('Point Index Buffer', new Uint32Array(idBuffer), GPUBufferUsage.VERTEX),
      destroy: () => {
        const { vertexBuffer, idBuffer } = source
        vertexBuffer.destroy()
        idBuffer.destroy()
      }
    }
    // build features
    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer))
  }

  #buildFeatures (source: PointSource, tile: Tile, featureGuideArray: Float32Array): void {
    const { context } = this
    const { mask } = tile
    const features: PointFeature[] = []

    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4)
      i += 4
      // build featureCode
      let featureCode: number[] = [0]

      featureCode = encodingSize > 0
        ? [...featureGuideArray.slice(i, i + encodingSize)]
        : [0]
      // update index
      i += encodingSize

      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      const { sourceName, lch, interactive, layerBuffer, layerCodeBuffer } = layerGuide

      const pointUniformBuffer = context.buildStaticGPUBuffer('Point Uniform Buffer', 'float', [0, 0, 8192, 8192], GPUBufferUsage.UNIFORM)
      const pointBindGroup = context.buildGroup(
        'Point BindGroup',
        this.#pointBindGroupLayout,
        [pointUniformBuffer]
      )
      const featureCodeBuffer = context.buildStaticGPUBuffer('Feature Code Buffer', 'float', [...featureCode, ...Array(64 - featureCode.length).fill(0)], GPUBufferUsage.STORAGE)
      const bindGroup = context.buildGroup(
        'Feature BindGroup',
        context.featureBindGroupLayout,
        [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
      )

      const feature: PointFeature = {
        type: 'point' as const,
        source,
        tile,
        count,
        offset,
        sourceName,
        layerIndex,
        featureCode,
        lch,
        interactive,
        bindGroup,
        pointBindGroup,
        draw: () => {
          context.setStencilReference(tile.tmpMaskID)
          this.draw(feature)
        },
        destroy: () => {
          pointUniformBuffer.destroy()
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
    const { device, format, defaultBlend, sampleCount, frameBindGroupLayout, featureBindGroupLayout } = context

    this.#pointBindGroupLayout = context.buildLayout('Point', ['uniform'], GPUShaderStage.VERTEX)

    const module = device.createShaderModule({ code: shaderCode })
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.#pointBindGroupLayout]
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
        topology: 'triangle-list',
        cullMode: 'none'
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

  draw ({ bindGroup, pointBindGroup, source, count, offset }: PointFeature): void {
    // get current source data
    const { passEncoder } = this.context
    const { vertexBuffer } = source

    // setup pipeline, bind groups, & buffers
    passEncoder.setPipeline(this.pipeline)
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setBindGroup(2, pointBindGroup)
    passEncoder.setVertexBuffer(0, vertexBuffer)
    // draw
    passEncoder.draw(6, count, 0, offset)
  }
}
