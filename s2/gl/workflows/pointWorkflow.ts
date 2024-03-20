import Workflow from './workflow'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

// WEBGL1
import vert1 from '../shaders/point1.vertex.glsl'
import frag1 from '../shaders/point1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/point2.vertex.glsl'
import frag2 from '../shaders/point2.fragment.glsl'

import type Context from '../contexts/context'
import type { PointData } from 'workers/worker.spec'
import type { TileGL as Tile } from 'source/tile.spec'
import type {
  LayerDefinitionBase,
  PointDefinition,
  PointStyle,
  PointWorkflowLayerGuide
} from 'style/style.spec'
import type {
  PointFeature,
  PointSource,
  PointWorkflow as PointWorkflowSpec,
  PointWorkflowUniforms
} from './workflow.spec'

export default class PointWorkflow extends Workflow implements PointWorkflowSpec {
  extentBuffer?: WebGLBuffer
  layerGuides = new Map<number, PointWorkflowLayerGuide>()
  declare uniforms: { [key in PointWorkflowUniforms]: WebGLUniformLocation }
  constructor (context: Context) {
    // get gl from context
    const { type, devicePixelRatio } = context
    // inject Program
    super(context)
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1, { aExtent: 0, aPos: 1, aID: 2 })
    else this.buildShaders(vert2, frag2)
    // activate so we can setup samplers
    this.use()
    // set device pixel ratio
    this.setDevicePixelRatio(devicePixelRatio)
  }

  #bindExtentBuffer (): void {
    const { gl, context, extentBuffer } = this

    if (extentBuffer === undefined) {
      // simple quad set
      // [[-1, -1], [1, -1], [-1, 1]]  &  [[1, -1], [1, 1], [-1, 1]]
      const typeArray = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1])
      this.extentBuffer = context.bindEnableVertexAttr(typeArray, 0, 2, gl.FLOAT, false, 0, 0)
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, extentBuffer)
      context.defineBufferState(0, 2, gl.FLOAT, false, 0, 0)
    }
  }

  buildSource (pointData: PointData, tile: Tile): void {
    const { gl, context } = this
    const { vertexBuffer: vertexB, idBuffer: idB, featureGuideBuffer } = pointData
    // prep buffers
    const vertexA = new Float32Array(vertexB)
    const idA = new Uint8Array(idB)
    // Create a starting vertex array object (attribute state)
    const vao = context.buildVAO()

    // bind buffers to the vertex array object
    // Create the feature index buffer
    const vertexBuffer = context.bindEnableVertexAttr(vertexA, 1, 2, gl.FLOAT, false, 8, 0, true)
    const idBuffer = context.bindEnableVertexAttr(idA, 2, 4, gl.UNSIGNED_BYTE, true, 0, 0, true)

    // bind the extentBuffer
    this.#bindExtentBuffer()

    const source: PointSource = {
      type: 'point',
      vertexBuffer,
      idBuffer,
      vao
    }

    context.cleanup() // flush vao

    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer))
  }

  #buildFeatures (source: PointSource, tile: Tile, featureGuideArray: Float32Array): void {
    const features: PointFeature[] = []

    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4)
      i += 4
      // build featureCode
      let featureCode: number[] = [0]
      let radius: number | undefined
      let color: [number, number, number, number] | undefined
      let stroke: [number, number, number, number] | undefined
      let opacity: number | undefined
      let strokeWidth: number | undefined
      if (this.type === 1) {
        const [ra, o, cr, cg, cb, ca, sr, sg, sb, sa, sw] = featureGuideArray.slice(i, i + 11)
        radius = ra
        opacity = o
        color = [cr, cg, cb, ca]
        stroke = [sr, sg, sb, sa]
        strokeWidth = sw
        i += 11
      } else {
        featureCode = encodingSize > 0
          ? [...featureGuideArray.slice(i, i + encodingSize)]
          : [0]
        // update index
        i += encodingSize
      }

      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      const { sourceName, layerCode, lch, interactive } = layerGuide

      features.push({
        type: 'point',
        source,
        tile,
        count,
        offset,
        sourceName,
        layerGuide,
        layerCode,
        featureCode,
        lch,
        radius,
        opacity,
        color,
        stroke,
        strokeWidth,
        interactive
      })
    }

    tile.addFeatures(features)
  }

  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: PointStyle): PointDefinition {
    const { type } = this
    const { source, layerIndex, lch, visible } = layerBase
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
    const layerDefinition: PointDefinition = {
      ...layerBase,
      type: 'point',
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
    // 2) Store layer workflow, building code if webgl2
    const layerCode: number[] = []
    if (type === 2) {
      for (const paint of [radius, opacity, color, stroke, strokeWidth]) {
        layerCode.push(...encodeLayerAttribute(paint, lch))
      }
    }
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      interactive,
      cursor,
      visible
    })

    return layerDefinition
  }

  use (): void {
    const { context } = this
    super.use()
    // Prepare context
    context.defaultBlend()
    context.enableDepthTest()
    context.disableCullFace()
    context.enableStencilTest()
    context.lequalDepth()
  }

  draw (featureGuide: PointFeature, _interactive = false): void {
    // grab context
    const { gl, type, context, uniforms } = this
    const { uColor, uRadius, uStroke, uSWidth, uOpacity, uBounds } = uniforms
    const { defaultBounds } = context
    // get current source data
    const {
      source, count, offset, featureCode, layerGuide: { layerIndex, visible }, color,
      radius, stroke, strokeWidth, opacity, bounds
    } = featureGuide
    if (!visible) return
    const { vao, vertexBuffer } = source
    context.stencilFuncAlways(0)
    context.setDepthRange(layerIndex)
    // if bounds exists, set them, otherwise set default bounds
    if (bounds !== undefined) gl.uniform4fv(uBounds, bounds)
    else gl.uniform4fv(uBounds, defaultBounds)
    // set feature code (webgl 1 we store the colors, webgl 2 we store layerCode lookups)
    if (type === 1) {
      gl.uniform4fv(uColor, color ?? [0, 0, 0, 1])
      gl.uniform1f(uRadius, radius ?? 1)
      gl.uniform4fv(uStroke, stroke ?? [0, 0, 0, 1])
      gl.uniform1f(uSWidth, strokeWidth ?? 1)
      gl.uniform1f(uOpacity, opacity ?? 1)
    } else { this.setFeatureCode(featureCode) }
    // setup offsets and draw
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 8, offset * 8)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count)
  }
}
