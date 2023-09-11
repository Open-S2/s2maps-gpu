import encodeLayerAttribute from './util/encodeLayerAttribute'

// WEBGL1
import vert1 from '../shaders/glyph1.vertex.glsl'
import frag1 from '../shaders/glyph1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/glyph2.vertex.glsl'
import frag2 from '../shaders/glyph2.fragment.glsl'

import type { Context, GlyphFeatureGuide, GlyphSource } from '../contexts/context.spec'
import type { GlyphImages } from 's2/workers/source/glyphSource'
import type {
  GlyphLayerDefinition,
  GlyphLayerStyle,
  GlyphWorkflowLayerGuide,
  LayerDefinitionBase,
  LayerStyle
} from 's2/style/style.spec'
import type { GlyphData } from 's2/workers/worker.spec'
import type { TileGL as Tile } from 's2/source/tile.spec'
import type {
  FBO,
  GlyphFilterProgram,
  GlyphProgram as GlyphProgramSpec,
  GlyphProgramUniforms
} from './program.spec'

export default async function glyphProgram (context: Context): Promise<GlyphProgramSpec> {
  const Program = await import('./program').then(m => m.default)

  class GlyphProgram extends Program implements GlyphProgramSpec {
    fbo: FBO
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
      // build an initial fbo
      this.fbo = this.#buildFramebuffer(200)
      // set the current fbo size
      gl.uniform2fv(uTexSize, this.fbo.texSize)
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
      const glyphFilterIDBuffer = context.bindEnableVertexAttr(glyphFilterIDs, 6, 3, gl.UNSIGNED_BYTE, true, 3, 0, true)

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
      const glyphQuadIDBuffer = context.bindEnableVertexAttr(glyphQuadIDs, 7, 3, gl.UNSIGNED_BYTE, true, 3, 0, true)
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
        let fill: [r: number, g: number, b: number, a: number] | undefined
        let stroke: [r: number, g: number, b: number, a: number] | undefined
        let strokeWidth: number | undefined
        if (this.type === 1) {
          if (type === 0) { // text
            // get fill, stroke, and stroke width. Increment
            size = featureGuideArray[i]
            fill = [...featureGuideArray.slice(i + 1, i + 5)] as [r: number, g: number, b: number, a: number]
            strokeWidth = featureGuideArray[i + 5]
            stroke = [...featureGuideArray.slice(i + 6, i + 10)] as [r: number, g: number, b: number, a: number]
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

    buildLayerDefinition (layerBase: LayerDefinitionBase, layer: LayerStyle): GlyphLayerDefinition {
      const { type } = this
      const { source, layerIndex, lch } = layerBase
      // PRE) get layer base
      let { paint, layout, interactive, cursor, overdraw } = layer as GlyphLayerStyle
      paint = paint ?? {}
      layout = layout ?? {}
      interactive = interactive ?? false
      cursor = cursor ?? 'default'
      overdraw = overdraw ?? false
      // 1) build definition
      const {
        'text-size': textSize,
        'text-fill': textFill,
        'text-stroke': textStroke,
        'text-stroke-width': textStrokeWidth,
        'icon-size': iconSize
      } = paint
      const {
        'text-family': textFamily,
        'text-field': textField,
        'text-anchor': textAnchor,
        'text-offset': textOffset,
        'text-padding': textPadding,
        'text-word-wrap': textWordWrap,
        'text-align': textAlign,
        'text-kerning': textKerning,
        'text-line-height': textLineHeight,
        'icon-family': iconFamily,
        'icon-field': iconField,
        'icon-anchor': iconAnchor,
        'icon-offset': iconOffset,
        'icon-padding': iconPadding
      } = layout
      const layerDefinition: GlyphLayerDefinition = {
        type: 'line',
        ...layerBase,
        paint: {
          textSize: textSize ?? 16,
          iconSize: iconSize ?? 16,
          textFill: textFill ?? 'rgb(0, 0, 0)',
          textStrokeWidth: textStrokeWidth ?? 16,
          textStroke: textStroke ?? 'rgb(0, 0, 0)'
        },
        layout: {
          textFamily: textFamily ?? '',
          textField: textField ?? '',
          textAnchor: textAnchor ?? 'center',
          textOffset: textOffset ?? 0,
          textPadding: textPadding ?? 0,
          textWordWrap: textWordWrap ?? 0,
          textAlign: textAlign ?? 'center',
          textKerning: textKerning ?? 0,
          textLineHeight: textLineHeight ?? 0,
          iconFamily: iconFamily ?? '',
          iconField: iconField ?? '',
          iconAnchor: iconAnchor ?? 'center',
          iconOffset: iconOffset ?? 0,
          iconPadding: iconPadding ?? 0
        },
        interactive,
        cursor,
        overdraw
      }
      // 2) Store layer workflow, building code if webgl2
      const layerCode: number[] = []
      if (type === 2) {
        for (const value of Object.values(layerDefinition.paint)) {
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
        overdraw
      })

      return layerDefinition
    }

    #buildFramebuffer (height: number): FBO {
      const { gl } = this
      const texture = gl.createTexture()
      if (texture === null) throw new Error('Failed to create glyph texture')
      const stencil = gl.createRenderbuffer()
      if (stencil === null) throw new Error('Failed to create glyph stencil')
      const glyphFramebuffer = gl.createFramebuffer()
      if (glyphFramebuffer === null) throw new Error('Failed to create glyph framebuffer')
      // TEXTURE BUFFER
      // pre-build the glyph texture
      // bind
      gl.bindTexture(gl.TEXTURE_2D, texture)
      // allocate size
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      // set filter system
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      // DEPTH & STENCIL BUFFER
      // bind
      gl.bindRenderbuffer(gl.RENDERBUFFER, stencil)
      // allocate size
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, 2048, height)
      // FRAMEBUFFER
      // bind
      gl.bindFramebuffer(gl.FRAMEBUFFER, glyphFramebuffer)
      // attach texture to glyphFramebuffer
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      // attach stencil renderbuffer to framebuffer
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil)
      // rebind our default framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)

      return {
        width: 2048,
        height,
        texSize: [2048, height],
        texture,
        stencil,
        glyphFramebuffer
      }
    }

    #increaseFBOSize (height: number): void {
      const { gl, context, fbo, uniforms } = this
      if (height <= fbo.height) return

      // use to update texture size
      this.use()
      // build the new fbo
      const newFBO = this.#buildFramebuffer(height)
      // copy over data
      if (context.type === 1) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.glyphFramebuffer)
        gl.bindTexture(gl.TEXTURE_2D, newFBO.texture)
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, 2048, fbo.height)
      } else {
        const gl2 = gl as WebGL2RenderingContext
        gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, fbo.glyphFramebuffer)
        gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, newFBO.glyphFramebuffer)
        gl2.blitFramebuffer(0, 0, 2048, fbo.height, 0, 0, 2048, fbo.height, gl.COLOR_BUFFER_BIT, gl.LINEAR)
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      // set the texture size uniform
      gl.uniform2fv(uniforms.uTexSize, newFBO.texSize)
      // delete old FBO and set new
      this.#deleteFBO(fbo)
      // update to new FBO
      this.fbo = newFBO
    }

    #deleteFBO (fbo: FBO): void {
      const { gl } = this
      if (fbo !== undefined) {
        gl.deleteTexture(fbo.texture)
        gl.deleteRenderbuffer(fbo.stencil)
        gl.deleteFramebuffer(fbo.glyphFramebuffer)
      }
    }

    injectImages (maxHeight: number, images: GlyphImages): void {
      const { gl } = this
      // increase texture size if necessary
      this.#increaseFBOSize(maxHeight)
      // iterate through images and store
      gl.bindTexture(gl.TEXTURE_2D, this.fbo.texture)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
      for (const { posX, posY, width, height, data } of images) {
        const srcData = new Uint8ClampedArray(data)
        gl.texSubImage2D(gl.TEXTURE_2D, 0, posX, posY, width, height, gl.RGBA, gl.UNSIGNED_BYTE, srcData, 0)
      }
    }

    use (): void {
      const { context } = this
      // prepare context
      context.defaultBlend()
      context.enableDepthTest()
      context.disableCullFace()
      context.disableStencilTest()
      super.use()
    }

    draw (featureGuide: GlyphFeatureGuide, interactive = false): void {
      const { gl, context, fbo, glyphFilterProgram, uniforms } = this
      const { type, defaultBounds } = context
      const { uSize, uFill, uStroke, uSWidth, uBounds, uIsStroke } = uniforms
      // pull out the appropriate data from the source
      const {
        source, overdraw, isIcon, layerIndex, featureCode, offset,
        count, size, fill, stroke, strokeWidth, bounds
      } = featureGuide
      const { glyphQuadBuffer, glyphQuadIDBuffer, glyphColorBuffer, vao } = source
      // grab glyph texture
      const { texture } = fbo
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
      gl.vertexAttribPointer(7, 3, gl.UNSIGNED_BYTE, true, 3, offset * 3)
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
      // cleanup fbos
      this.#deleteFBO(this.fbo)
      // continue forward
      super.delete()
    }
  }

  return new GlyphProgram(context)
}
