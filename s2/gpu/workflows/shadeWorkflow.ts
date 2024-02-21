/* eslint-env browser */
import shaderCode from '../shaders/shade.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type {
  MaskSource,
  ShadeFeature as ShadeFeatureSpec,
  ShadeWorkflow as ShadeWorkflowSpec
} from './workflow.spec'
import type { WebGPUContext } from '../context'
import type {
  LayerDefinitionBase,
  ShadeLayerDefinition,
  ShadeLayerDefinitionGPU,
  ShadeLayerStyle
} from 'style/style.spec'
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

export class ShadeFeature implements ShadeFeatureSpec {
  type = 'shade' as const
  maskLayer = true
  sourceName = 'mask'
  source: MaskSource
  count: number
  offset: number
  featureCode = [0]
  bindGroup: GPUBindGroup
  constructor (
    public workflow: ShadeWorkflowSpec,
    public tile: Tile,
    public layerIndex: number,
    public layerGuide: ShadeLayerDefinitionGPU,
    public featureCodeBuffer: GPUBuffer
  ) {
    const { mask } = tile
    this.source = mask
    this.count = mask.count
    this.offset = mask.offset
    this.bindGroup = this.#buildBindGroup()
  }

  draw (): void {
    const { workflow } = this
    workflow.context.setStencilReference(this.tile.tmpMaskID)
    workflow.draw(this)
  }

  destroy (): void {
    this.featureCodeBuffer.destroy()
  }

  #buildBindGroup (): GPUBindGroup {
    const { workflow, tile, layerGuide, featureCodeBuffer } = this
    const { context } = workflow
    const { mask } = tile
    const { layerBuffer, layerCodeBuffer } = layerGuide
    return context.buildGroup(
      'Shade Feature BindGroup',
      context.featureBindGroupLayout,
      [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
    )
  }
}

export default class ShadeWorkflow implements ShadeWorkflowSpec {
  context: WebGPUContext
  layerDefinition!: ShadeLayerDefinitionGPU
  pipeline!: GPURenderPipeline
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    this.pipeline = await this.#getPipeline()
  }

  destroy (): void {
    const { layerBuffer, layerCodeBuffer } = this.layerDefinition
    layerBuffer.destroy()
    layerCodeBuffer.destroy()
  }

  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: ShadeLayerStyle): ShadeLayerDefinitionGPU {
    const { context } = this
    const { lch, layerIndex } = layerBase
    let { color } = layer
    color = color ?? 'rgb(0.6, 0.6, 0.6)'
    // 2) build the layerCode
    const layerCode: number[] = []
    layerCode.push(...encodeLayerAttribute(color, lch))
    // 3) Setup layer buffers in GPU
    const layerBuffer = context.buildGPUBuffer('Layer Uniform Buffer', new Float32Array([context.getDepthPosition(layerIndex), ~~lch]), GPUBufferUsage.UNIFORM)
    const layerCodeBuffer = context.buildGPUBuffer('Layer Code Buffer', new Float32Array(layerCode), GPUBufferUsage.STORAGE)
    // 4) store the layerDefinition and return
    this.layerDefinition = {
      ...layerBase,
      type: 'shade' as const,
      // layout
      color,
      // GPU buffers
      layerBuffer,
      layerCodeBuffer
    }

    return this.layerDefinition
  }

  // given a set of layerIndexes that use Masks and the tile of interest
  buildMaskFeature ({ layerIndex, minzoom, maxzoom }: ShadeLayerDefinition, tile: Tile): void {
    const { context, layerDefinition } = this
    const { zoom } = tile
    // not in the zoom range, ignore
    if (zoom < minzoom || zoom > maxzoom) return

    const featureCodeBuffer = context.buildGPUBuffer('Feature Code Buffer', new Float32Array([0]), GPUBufferUsage.STORAGE)
    const feature = new ShadeFeature(this, tile, layerIndex, layerDefinition, featureCodeBuffer)
    tile.addFeatures([feature])
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 6: it is recommended to create pipeline asynchronously
  // BEST PRACTICE 7: explicitly define pipeline layouts
  async #getPipeline (): Promise<GPURenderPipeline> {
    const { device, format, sampleCount, frameBindGroupLayout, featureBindGroupLayout } = this.context

    const module = device.createShaderModule({ code: shaderCode })
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout]
    })

    const stencilState: GPUStencilFaceState = {
      compare: 'always',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'keep'
    }

    return await device.createRenderPipelineAsync({
      label: 'Shade Pipeline',
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
          blend: {
            color: {
              srcFactor: 'dst',
              dstFactor: 'zero',
              operation: 'add' // common operation
            },
            alpha: {
              srcFactor: 'dst',
              dstFactor: 'zero',
              operation: 'add' // assuming you want the same for alpha
            }
          }
        }]
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
        stencilReadMask: 0,
        stencilWriteMask: 0
      }
    })
  }

  draw ({ layerGuide, source, bindGroup }: ShadeFeatureSpec): void {
    if (!layerGuide.visible) return
    const { context, pipeline } = this
    const { passEncoder } = context
    const { vertexBuffer, indexBuffer, count, offset } = source
    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(pipeline)
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setIndexBuffer(indexBuffer, 'uint32')
    passEncoder.setBindGroup(1, bindGroup)
    // draw
    passEncoder.drawIndexed(count, 1, offset)
  }
}
