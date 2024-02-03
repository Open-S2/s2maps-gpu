import encodeLayerAttribute from 'style/encodeLayerAttribute'

// WEBGL1
import vert1 from '../shaders/glyph1.vertex.glsl'
import frag1 from '../shaders/glyph1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/glyph2.vertex.glsl'
import frag2 from '../shaders/glyph2.fragment.glsl'

import type { Context, GlyphFeatureGuide, GlyphSource } from '../contexts/context.spec'
import type { ColorArray } from 'style/color'
import type {
  GlyphLayerDefinition,
  GlyphLayerStyle,
  GlyphWorkflowLayerGuide,
  LayerDefinitionBase
} from 'style/style.spec'
import type { GlyphData } from 'workers/worker.spec'
import type { TileGL as Tile } from 'source/tile.spec'
import type {
  GlyphFilterProgram,
  GlyphProgram as GlyphProgramSpec,
  GlyphProgramUniforms
} from './program.spec'

export default async function glyphProgram (context: Context): Promise<GlyphProgramSpec> {
  const Program = await import('./program').then(m => m.default)

  class GlyphProgram extends Program implements GlyphProgramSpec {
    stepBuffer?: WebGLBuffer
    uvBuffer?: WebGLBuffer
    glyphFilterProgram!: GlyphFilterProgram
    layerGuides = new Map<number, GlyphWorkflowLayerGuide>()
    declare uniforms: { [key in GlyphProgramUniforms]: WebGLUniformLocation }
    constructor (context: Context) {
      // get gl from context
      const { gl, type, devicePixelRatio } = context
      // inject Program
      super(context)
      // build shaders
      const attributeLocations = { aUV: 0, aST: 1, aXY: 2, aOffset: 3, aWH: 4, aTexXY: 5, aTexWH: 6, aID: 7, aColor: 8 }
      if (type === 1) this.buildShaders(vert1, frag1, attributeLocations)
      else this.buildShaders(vert2, frag2)
      // activate so we can setup samplers
      this.use()
      const { uFeatures, uGlyphTex, uTexSize } = this.uniforms
      // set texture positions
      gl.uniform1i(uFeatures, 0) // uFeatures texture unit 0
      gl.uniform1i(uGlyphTex, 1) // uGlyphTex texture unit 1
      // setup the devicePixelRatio
      this.setDevicePixelRatio(devicePixelRatio)
      // set the current fbo size
      gl.uniform2fv(uTexSize, context.sharedFBO.texSize)
    }

    #bindStepBuffer (): void {
      const { gl, context, stepBuffer } = this

      if (stepBuffer === undefined) {
        const stepVerts = new Float32Array([0, 1])
        this.stepBuffer = context.bindEnableVertexAttr(stepVerts, 0, 1, gl.FLOAT, false, 0, 0)
      } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, stepBuffer)
        context.defineBufferState(0, 1, gl.FLOAT, false, 0, 0)
      }
    }

    #bindUVBuffer (): void {
      const { gl, context, uvBuffer } = this

      if (uvBuffer === undefined) {
        const uvVerts = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
        this.uvBuffer = context.bindEnableVertexAttr(uvVerts, 0, 2, gl.FLOAT, false, 0, 0)
      } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
        context.defineBufferState(0, 2, gl.FLOAT, false, 0, 0)
      }
    }

    injectFilter (glyphFilterProgram: GlyphFilterProgram): void {
      this.glyphFilterProgram = glyphFilterProgram
    }

    buildSource (glyphData: GlyphData, tile: Tile): void {
      const { gl, context } = this
      const { featureGuideBuffer } = glyphData

      // STEP 1 - FILTER
      const filterVAO = context.buildVAO()
      // Create the UV buffer
      this.#bindStepBuffer()
      // create the boxVertex buffer
      const glyphFilterVerts = new Float32Array(glyphData.glyphFilterBuffer)
      const glyphFilterBuffer = context.bindEnableVertexAttrMulti(glyphFilterVerts, [
        // [indx, size, type, normalized, stride, offset]
        [1, 2, gl.FLOAT, false, 36, 0], // s, t
        [2, 2, gl.FLOAT, false, 36, 8], // x, y
        [3, 2, gl.FLOAT, false, 36, 16], // padding
        [4, 2, gl.FLOAT, false, 36, 24], // width, height
        [5, 1, gl.FLOAT, false, 36, 32] // index
      ], true)
      // id buffer
      const glyphFilterIDs = new Uint8Array(glyphData.glyphFilterIDBuffer)
      const glyphFilterIDBuffer = context.bindEnableVertexAttr(glyphFilterIDs, 6, 4, gl.UNSIGNED_BYTE, true, 4, 0, true)

      // STEP 2 - QUADS
      const vao = context.buildVAO()
      // Create the UV buffer
      this.#bindUVBuffer()
      // create the vertex and color buffers
      const glyphQuadVerts = new Float32Array(glyphData.glyphQuadBuffer)
      const glyphQuadBuffer = context.bindEnableVertexAttrMulti(glyphQuadVerts, [
        // [indx, size, type, normalized, stride, offset]
        [1, 2, gl.FLOAT, false, 48, 0], // s, t
        [2, 2, gl.FLOAT, false, 48, 8], // x, y
        [3, 2, gl.FLOAT, false, 48, 16], // xOffset, yOffset
        [4, 2, gl.FLOAT, false, 48, 24], // width, height
        [5, 2, gl.FLOAT, false, 48, 32], // texture-x, texture-y
        [6, 2, gl.FLOAT, false, 48, 40] // texture-width, texture-height
      ], true)
      // create id buffer
      const glyphQuadIDs = new Uint8Array(glyphData.glyphQuadIDBuffer)
      const glyphQuadIDBuffer = context.bindEnableVertexAttr(glyphQuadIDs, 7, 4, gl.UNSIGNED_BYTE, true, 4, 0, true)
      // create the vertex and color buffers
      const glyphColorVerts = new Uint8Array(glyphData.glyphColorBuffer)
      const glyphColorBuffer = context.bindEnableVertexAttr(glyphColorVerts, 8, 4, gl.UNSIGNED_BYTE, true, 4, 0, true)

      const source: GlyphSource = {
        type: 'glyph',
        glyphFilterBuffer,
        glyphFilterIDBuffer,
        glyphQuadBuffer,
        glyphQuadIDBuffer,
        glyphColorBuffer,
        filterVAO,
        vao
      }
      // cleanup
      context.cleanup()
      this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer))
    }

    #buildFeatures (source: GlyphSource, tile: Tile, featureGuideArray: Float32Array): void {
      const features: GlyphFeatureGuide[] = []

      const lgl = featureGuideArray.length
      let i = 0
      while (i < lgl) {
        // curlayerIndex, curType, filterOffset, filterCount, quadOffset, quadCount, encoding.length, ...encoding
        const [layerIndex, type, filterOffset, filterCount, offset, count, encodingSize] = featureGuideArray.slice(i, i + 7)
        i += 7
        // If webgl1, we pull out the color and opacity otherwise build featureCode
        let featureCode: number[] = [0]
        let size: number | undefined
        let fill: ColorArray | undefined
        let stroke: ColorArray | undefined
        let strokeWidth: number | undefined
        if (this.type === 1) {
          if (type === 0) { // text
            // get fill, stroke, and stroke width. Increment
            size = featureGuideArray[i]
            fill = [...featureGuideArray.slice(i + 1, i + 5)] as ColorArray
            strokeWidth = featureGuideArray[i + 5]
            stroke = [...featureGuideArray.slice(i + 6, i + 10)] as ColorArray
          } else { // icon
            size = featureGuideArray[i]
          }
        } else {
          if (encodingSize > 0) featureCode = [...featureGuideArray.slice(i, i + encodingSize)]
        }
        // update index
        i += encodingSize

        const layerGuide = this.layerGuides.get(layerIndex)
        if (layerGuide === undefined) continue
        const { sourceName, layerCode, lch, interactive, overdraw } = layerGuide

        features.push({
          type: 'glyph',
          source,
          tile,
          count,
          offset,
          filterCount,
          filterOffset,
          sourceName,
          layerIndex,
          layerCode,
          featureCode,
          lch,
          interactive,
          overdraw,
          size,
          fill,
          stroke,
          strokeWidth,
          isIcon: type === 1
        })
      }

      tile.addFeatures(features)
    }

    buildLayerDefinition (layerBase: LayerDefinitionBase, layer: GlyphLayerStyle): GlyphLayerDefinition {
      const { type } = this
      const { source, layerIndex, lch } = layerBase
      // PRE) get layer base
      let {
        // paint
        textSize, iconSize, textFill, textStrokeWidth, textStroke,
        // layout
        textFamily, textField, textAnchor, textOffset, textPadding, textWordWrap,
        textAlign, textKerning, textLineHeight, iconFamily, iconField, iconAnchor,
        iconOffset, iconPadding,
        // properties
        interactive, cursor, overdraw, viewCollisions, onlyPoints, onlyLines
      } = layer
      textSize = textSize ?? 16
      iconSize = iconSize ?? 16
      textFill = textFill ?? 'rgb(0, 0, 0)'
      textStrokeWidth = textStrokeWidth ?? 16
      textStroke = textStroke ?? 'rgb(0, 0, 0)'
      interactive = interactive ?? false
      cursor = cursor ?? 'default'
      overdraw = overdraw ?? false
      viewCollisions = viewCollisions ?? false
      onlyPoints = onlyPoints ?? false
      onlyLines = onlyLines ?? false
      // 1) build definition
      const layerDefinition: GlyphLayerDefinition = {
        ...layerBase,
        type: 'glyph',
        // paint
        textSize,
        iconSize,
        textFill,
        textStrokeWidth,
        textStroke,
        // layout
        textFamily: textFamily ?? '',
        textField: textField ?? '',
        textAnchor: textAnchor ?? 'center',
        textOffset: textOffset ?? [0, 0],
        textPadding: textPadding ?? [0, 0],
        textWordWrap: textWordWrap ?? 0,
        textAlign: textAlign ?? 'center',
        textKerning: textKerning ?? 0,
        textLineHeight: textLineHeight ?? 0,
        iconFamily: iconFamily ?? '',
        iconField: iconField ?? '',
        iconAnchor: iconAnchor ?? 'center',
        iconOffset: iconOffset ?? [0, 0],
        iconPadding: iconPadding ?? [0, 0],
        // properties
        viewCollisions,
        interactive,
        cursor,
        overdraw,
        onlyPoints,
        onlyLines
      }
      // 2) Store layer workflow, building code if webgl2
      const layerCode: number[] = []
      if (type === 2) {
        for (const value of [textSize, iconSize, textFill, textStrokeWidth, textStroke]) {
          layerCode.push(...encodeLayerAttribute(value, lch))
        }
      }
      this.layerGuides.set(layerIndex, {
        sourceName: source,
        layerIndex,
        layerCode,
        lch,
        interactive,
        cursor,
        overdraw,
        viewCollisions
      })

      return layerDefinition
    }

    use (): void {
      const { context, uniforms } = this
      const { gl, sharedFBO } = context
      // prepare context
      context.defaultBlend()
      context.enableDepthTest()
      context.disableCullFace()
      context.disableStencilTest()
      super.use()
      // set the texture size uniform
      gl.uniform2fv(uniforms.uTexSize, sharedFBO.texSize)
    }

    draw (featureGuide: GlyphFeatureGuide, interactive = false): void {
      const { gl, context, glyphFilterProgram, uniforms } = this
      const { type, defaultBounds, sharedFBO } = context
      const { uSize, uFill, uStroke, uSWidth, uBounds, uIsStroke } = uniforms
      // pull out the appropriate data from the source
      const {
        source, overdraw, isIcon, layerIndex, featureCode, offset,
        count, size, fill, stroke, strokeWidth, bounds
      } = featureGuide
      const { glyphQuadBuffer, glyphQuadIDBuffer, glyphColorBuffer, vao } = source
      // grab glyph texture
      const { texture } = sharedFBO
      // WebGL1 - set paint properties; WebGL2 - set feature code
      if (type === 1) {
        gl.uniform1f(uSize, size ?? 0)
        gl.uniform4fv(uFill, fill ?? [0, 0, 0, 1])
        gl.uniform4fv(uStroke, stroke ?? [0, 0, 0, 1])
        gl.uniform1f(uSWidth, strokeWidth ?? 0)
      } else { this.setFeatureCode(featureCode) }
      // if bounds exists, set them, otherwise set default bounds
      if (bounds !== undefined) gl.uniform4fv(uBounds, bounds)
      else gl.uniform4fv(uBounds, defaultBounds)
      // set depth type
      if (interactive) context.lessDepth()
      else context.lequalDepth()
      // context.lequalDepth()
      context.setDepthRange(layerIndex)
      // set overdraw
      gl.uniform1i(uniforms.uOverdraw, ~~overdraw)
      // set draw type
      gl.uniform1i(uniforms.uIsIcon, ~~isIcon)
      // bind the correct glyph texture
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      // ensure glyphFilterProgram's result texture is set
      gl.activeTexture(gl.TEXTURE0)
      glyphFilterProgram.bindResultTexture()
      // use vao
      gl.bindVertexArray(vao)
      // apply the appropriate offset in the source vertexBuffer attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, glyphQuadBuffer)
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 48, offset * 48) // s, t
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 48, 8 + (offset * 48)) // x, y
      gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 48, 16 + (offset * 48)) // xOffset, yOffset
      gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 48, 24 + (offset * 48)) // width, height
      gl.vertexAttribPointer(5, 2, gl.FLOAT, false, 48, 32 + (offset * 48)) // texture x, y
      gl.vertexAttribPointer(6, 2, gl.FLOAT, false, 48, 40 + (offset * 48)) // width, height
      gl.bindBuffer(gl.ARRAY_BUFFER, glyphQuadIDBuffer)
      gl.vertexAttribPointer(7, 4, gl.UNSIGNED_BYTE, true, 4, offset * 4)
      gl.bindBuffer(gl.ARRAY_BUFFER, glyphColorBuffer)
      gl.vertexAttribPointer(8, 4, gl.UNSIGNED_BYTE, true, 4, offset * 4)
      // draw. If type is "text" than draw the stroke first, then fill
      if (!isIcon) {
        gl.uniform1i(uIsStroke, 1)
        gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count)
        gl.uniform1i(uIsStroke, 0)
      }
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count)
    }

    delete (): void {
      // continue forward
      super.delete()
    }
  }

  return new GlyphProgram(context)
}
