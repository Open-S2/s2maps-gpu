/* eslint-env browser */
import shaderCode from '../shaders/shade.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type { ShadeFeature, ShadeWorkflow as ShadeWorkflowSpec } from './workflow.spec'
import type { WebGPUContext } from '../context'
import type { LayerDefinitionBase, ShadeLayerDefinitionGPU, ShadeLayerStyle } from 'style/style.spec'
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

export default class ShadeWorkflow implements ShadeWorkflowSpec {
  context: WebGPUContext
  #layerDefinition!: ShadeLayerDefinitionGPU
  pipeline!: GPURenderPipeline
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    this.pipeline = await this.#getPipeline()
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
    const layerBuffer = context.buildStaticGPUBuffer('Layer Uniform Buffer', 'float', [context.getDepthPosition(layerIndex), ~~lch], GPUBufferUsage.UNIFORM)
    const layerCodeBuffer = context.buildStaticGPUBuffer('Layer Code Buffer', 'float', [...layerCode, ...Array(128 - layerCode.length).fill(0)], GPUBufferUsage.STORAGE)
    // 4) store the layerDefinition and return
    this.#layerDefinition = {
      ...layerBase,
      type: 'shade',
      // layout
      color,
      // GPU buffers
      layerBuffer,
      layerCodeBuffer
    }

    return this.#layerDefinition
  }

  // given a set of layerIndexes that use Masks and the tile of interest
  buildMaskFeature ({ layerIndex, lch, minzoom, maxzoom }: ShadeLayerDefinitionGPU, tile: Tile): void {
    const { context } = this
    const { mask, zoom } = tile
    const { layerBuffer, layerCodeBuffer } = this.#layerDefinition
    // not in the zoom range, ignore
    if (zoom < minzoom || zoom > maxzoom) return

    const featureCodeBuffer = context.buildStaticGPUBuffer('Feature Code Buffer', 'float', Array(64).fill(0), GPUBufferUsage.STORAGE)
    const bindGroup = context.buildGroup(
      'Feature BindGroup',
      context.featureBindGroupLayout,
      [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
    )
    const feature: ShadeFeature = {
      type: 'shade',
      maskLayer: true,
      sourceName: 'mask',
      source: mask,
      count: mask.count,
      offset: mask.offset,
      tile,
      layerIndex,
      featureCode: [0],
      lch,
      bindGroup,
      draw: () => {
        context.setStencilReference(tile.tmpMaskID)
        this.draw(feature)
      }
    }
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

  draw (feature: ShadeFeature): void {
    const { context, pipeline } = this
    const { passEncoder } = context
    const { source, bindGroup } = feature
    const { vertexBuffer, indexBuffer, count, offset } = source
    // setup pipeline, bind groups, & buffers
    passEncoder.setPipeline(pipeline)
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setIndexBuffer(indexBuffer, 'uint32')
    // draw
    passEncoder.drawIndexed(count, 1, offset)
  }
}
