import encodeLayerAttribute from 'style/encodeLayerAttribute'
import { buildDashImage } from 'style/color'

// WEBGL1
import vert1 from '../shaders/line1.vertex.glsl'
import frag1 from '../shaders/line1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/line2.vertex.glsl'
import frag2 from '../shaders/line2.fragment.glsl'

import type { Context, LineFeatureGuide, LineSource } from '../contexts/context.spec'
import type { LineProgram as LineProgramSpec, LineProgramUniforms } from './program.spec'
import type { TileGL as Tile } from 'source/tile.spec'
import type { LineData } from 'workers/worker.spec'
import type {
  LayerDefinitionBase,
  LineLayerDefinition,
  LineLayerStyle,
  LineWorkflowLayerGuide
} from 'style/style.spec'

export default async function lineProgram (context: Context): Promise<LineProgramSpec> {
  const Program = await import('./program').then(m => m.default)

  class LineProgram extends Program implements LineProgramSpec {
    curTexture = -1
    typeBuffer?: WebGLBuffer
    nullTexture: WebGLTexture
    layerGuides = new Map<number, LineWorkflowLayerGuide>()
    declare uniforms: { [key in LineProgramUniforms]: WebGLUniformLocation }
    constructor (context: Context) {
      // get gl from context
      const { gl, type, devicePixelRatio } = context
      // inject Program
      super(context)
      // build shaders
      if (type === 1) this.buildShaders(vert1, frag1, { aType: 0, aPrev: 1, aCurr: 2, aNext: 3, aLengthSoFar: 4 })
      else this.buildShaders(vert2, frag2)
      // activate so we can setup samplers
      this.use()
      // create the null texture align with line
      this.nullTexture = context.buildTexture(null, 1, 1)
      gl.bindTexture(gl.TEXTURE_2D, this.nullTexture)
      // set device pixel ratio
      this.setDevicePixelRatio(devicePixelRatio)
    }

    #bindTypeBuffer (): void {
      const { gl, context, typeBuffer } = this

      if (typeBuffer === undefined) {
        // 0 -> curr
        // 1 -> curr + (-1 * normal)
        // 2 -> curr + (normal)
        // 3 -> next + (-1 * normal)
        // 4 -> next + (normal)
        // 5 -> curr + (normal) [check that prev, curr, and next is CCW otherwise invert normal]
        // 6 -> curr + (previous-normal) [check that prev, curr, and next is CCW otherwise invert normal]
        const typeArray = new Float32Array([1, 3, 4, 1, 4, 2, 0, 5, 6])
        this.typeBuffer = context.bindEnableVertexAttr(typeArray, 0, 1, gl.FLOAT, false, 0, 0)
      } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, typeBuffer)
        context.defineBufferState(0, 1, gl.FLOAT, false, 0, 0)
      }
    }

    // programs helps design the appropriate layer parameters
    buildLayerDefinition (layerBase: LayerDefinitionBase, layer: LineLayerStyle): LineLayerDefinition {
      const { type } = this
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
      if (type === 2) {
        for (const paint of [color, opacity, width, gapwidth]) {
          layerCode.push(...encodeLayerAttribute(paint, lch))
        }
      }
      // if dashed, build a texture
      const { length, image } = buildDashImage(dasharray)
      const dashTexture = length > 0 ? context.buildTexture(image, length, 4, true) : undefined
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

    buildSource (lineData: LineData, tile: Tile): void {
      const { gl, context } = this
      const { featureGuideBuffer } = lineData
      // prep buffers
      const vertexA = new Int16Array(lineData.vertexBuffer)
      const lengthSoFarA = new Float32Array(lineData.lengthSoFarBuffer)
      // const fillIDA = new Uint8Array(lineData.fillIDBuffer)
      // Create a starting vertex array object (attribute state)
      const vao = gl.createVertexArray()
      if (vao === null) throw new Error('Failed to create vertex array object')
      // and make it the one we're currently working with
      gl.bindVertexArray(vao)

      // bind buffers to the vertex array object
      const vertexBuffer = context.bindEnableVertexAttrMulti(vertexA, [
        // [indx, size, type, normalized, stride, offset]
        [1, 2, gl.FLOAT, false, 24, 0],
        [2, 2, gl.FLOAT, false, 24, 8],
        [3, 2, gl.FLOAT, false, 24, 16]
      ], true)
      const lengthSoFarBuffer = lengthSoFarA.byteLength > 0
        ? context.bindEnableVertexAttr(lengthSoFarA, 4, 1, gl.FLOAT, false, 0, 0)
        : undefined
      // const fillIDBuffer = context.bindEnableVertexAttr(fillIDA, 6, 3, gl.UNSIGNED_BYTE, true, 0, 0)

      // bind the typeBuffer
      this.#bindTypeBuffer()

      const source: LineSource = {
        type: 'line',
        vertexBuffer,
        lengthSoFarBuffer,
        // fillIDBuffer,
        vao
      }
      context.cleanup() // flush vao

      this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer))
    }

    #buildFeatures (source: LineSource, tile: Tile, featureGuideArray: Float32Array): void {
      const features: LineFeatureGuide[] = []

      const lgl = featureGuideArray.length
      let i = 0
      while (i < lgl) {
        // grab the size, layerIndex, count, and offset, and update the index
        const [cap, layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 5)
        i += 5
        // build featureCode
        let featureCode: number[] = [0]
        let color: [number, number, number, number] | undefined
        let opacity: number | undefined
        let width: number | undefined
        let gapwidth: number | undefined
        if (this.type === 1) {
          const [r, g, b, a, o, w, gw] = featureGuideArray.slice(i, i + 7)
          color = [r, g, b, a]
          opacity = o
          width = w
          gapwidth = gw
          i += 7
        } else {
          featureCode = encodingSize > 0
            ? [...featureGuideArray.slice(i, i + encodingSize)]
            : [0]
          // update index
          i += encodingSize
        }

        const layerGuide = this.layerGuides.get(layerIndex)
        if (layerGuide === undefined) continue
        const { sourceName, layerCode, lch, dashed, dashTexture, interactive } = layerGuide

        features.push({
          type: 'line',
          source,
          tile,
          count,
          offset,
          sourceName,
          dashed,
          dashTexture,
          cap,
          layerIndex,
          layerCode,
          featureCode,
          lch,
          color,
          opacity,
          width,
          gapwidth,
          interactive
        })
      }

      tile.addFeatures(features)
    }

    use (): void {
      const { context } = this
      // setup context
      context.defaultBlend()
      context.disableCullFace()
      context.enableDepthTest()
      context.enableStencilTest()
      context.lequalDepth()
      super.use()
    }

    draw (featureGuide: LineFeatureGuide, _interactive = false): void {
      // grab context
      const { gl, context, type, uniforms } = this
      const { uCap, uDashed, uColor, uOpacity, uWidth } = uniforms
      // get current source data
      const {
        count, offset, layerIndex, featureCode, source, cap, dashed, dashTexture, color, opacity, width
      } = featureGuide
      const { vao, vertexBuffer } = source
      context.setDepthRange(layerIndex)
      // set cap and dashed
      gl.uniform1f(uCap, cap)
      gl.uniform1i(uDashed, ~~dashed)
      // ensure a dash texture is mapped, if feature isn't dashed, use nullTexture
      if (dashed && dashTexture !== undefined && this.curTexture !== layerIndex) {
        this.curTexture = layerIndex
        gl.bindTexture(gl.TEXTURE_2D, dashTexture)
      }
      // set feature code
      if (type === 1) {
        gl.uniform4fv(uColor, color ?? [0, 0, 0, 1])
        gl.uniform1f(uOpacity, opacity ?? 1)
        gl.uniform1f(uWidth, width ?? 1)
      } else { this.setFeatureCode(featureCode) }
      // bind vao
      gl.bindVertexArray(vao)
      // apply the appropriate offset in the source vertexBuffer attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 0 + (offset * 24))
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 8 + (offset * 24))
      gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 24, 16 + (offset * 24))
      // draw elements
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 9, count) // gl.drawArraysInstancedANGLE(mode, first, count, primcount)
    }
  }

  return new LineProgram(context)
}
