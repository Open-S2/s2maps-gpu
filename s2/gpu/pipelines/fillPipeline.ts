/* eslint-env browser */
import vert from '../shaders/fill.vert.wgsl'
import frag from '../shaders/fill.frag.wgsl'

import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type { WebGPUContext } from '../context'
import type { FillFeatureGuide } from 'gpu'
import type { FillPipeline as FillPipelineSpec } from './pipeline.spec'
import type {
  FillLayerDefinition,
  FillLayerStyle,
  FillWorkflowLayerGuide,
  LayerDefinitionBase,
  LayerStyle
} from 'style/style.spec'
import type { FillData } from 'workers/worker.spec'
import type { Tile } from 'source/tile.spec'

export default async function fillPipeline (context: WebGPUContext): Promise<FillPipelineSpec> {
  const Pipeline = await import('./pipeline').then(m => m.default)

  class FillPipeline extends Pipeline implements FillPipelineSpec {
    layerGuides = new Map<number, FillWorkflowLayerGuide>()

    // programs helps design the appropriate layer parameters
    buildLayerDefinition (layerBase: LayerDefinitionBase, layer: LayerStyle): FillLayerDefinition {
      const { source, layerIndex, lch } = layerBase
      // PRE) get layer base
      let { paint, invert, opaque, interactive, cursor } = layer as FillLayerStyle
      paint = paint ?? {}
      invert = invert ?? false
      opaque = opaque ?? false
      interactive = interactive ?? false
      cursor = cursor ?? 'default'
      // 1) build definition
      let { color, opacity } = paint
      color = color ?? 'rgb(0, 0, 0)'
      opacity = opacity ?? 1
      const layerDefinition: FillLayerDefinition = {
        type: 'fill',
        ...layerBase,
        paint: { color, opacity },
        invert,
        interactive,
        opaque,
        cursor
      }
      // 2) Store layer workflow, building code if webgl2
      const layerCode: number[] = []
      for (const value of Object.values(layerDefinition.paint)) {
        layerCode.push(...encodeLayerAttribute(value, lch))
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

    buildSource (fillData: FillData, tile: Tile): void {
      // const { gl, context } = this
      // const { featureGuideBuffer } = fillData
      // // prep buffers
      // const vertexA = new Int16Array(fillData.vertexBuffer)
      // const indexA = new Uint32Array(fillData.indexBuffer)
      // const fillIDA = new Uint8Array(fillData.fillIDBuffer)
      // const codeTypeA = new Uint8Array(fillData.codeTypeBuffer)
      // // Create a starting vertex array object (attribute state)
      // const vao = context.buildVAO()

      // // bind buffers to the vertex array object
      // // Create the feature index buffer
      // const vertexBuffer = context.bindEnableVertexAttr(vertexA, 0, 2, gl.SHORT, false, 0, 0)
      // const indexBuffer = context.bindElementArray(indexA)
      // const fillIDBuffer = context.bindEnableVertexAttr(fillIDA, 1, 3, gl.UNSIGNED_BYTE, true, 0, 0)
      // const codeTypeBuffer = context.bindEnableVertexAttr(codeTypeA, 2, 1, gl.UNSIGNED_BYTE, false, 0, 0)

      // const source: FillSource = {
      //   type: 'fill',
      //   vertexBuffer,
      //   indexBuffer,
      //   fillIDBuffer,
      //   codeTypeBuffer,
      //   vao
      // }

      // context.cleanup() // flush vao

      // this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer))
    }

    async setup (): Promise<void> {
      await super.setup(
        vert,
        frag,
        [
          { // position
            arrayStride: 4 * 2,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x2'
              }
            ]
          },
          { // id
            arrayStride: 4 * 2,
            attributes: [
              {
                shaderLocation: 1,
                offset: 0,
                format: 'float32x2'
              }
            ]
          },
          { // index
            arrayStride: 4 * 4,
            attributes: [
              {
                shaderLocation: 2,
                offset: 0,
                format: 'float32x4'
              }
            ]
          }
        ],
        {
          topology: 'triangle-list',
          cullMode: 'back'
        },
        {
          depthWriteEnabled: true,
          depthCompare: 'less',
          format: 'depth24plus'
        }
      )
    }

    use (passEncoder: GPURenderPassEncoder): void {
      super.use(passEncoder)
      // passEncoder.setBindGroup(1, this.#modelBufferBindGroup)
    }

    draw (featureGuide: FillFeatureGuide, passEncoder: GPURenderPassEncoder): void {
      // get current source data
      const { source, count, offset } = featureGuide
      // TODO: Set feature based uniforms
      // set feature code (webgl 1 we store the colors, webgl 2 we store layerCode lookups)
      // this.setFeatureCode(featureCode)
      // draw
      passEncoder.setPipeline(this.pipeline)
      passEncoder.setVertexBuffer(0, source.vertexBuffer)
      passEncoder.draw(count, 1, offset, 0)
    }
  }

  return new FillPipeline(context)
}
