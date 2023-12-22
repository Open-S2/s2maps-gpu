import encodeLayerAttribute from 'style/encodeLayerAttribute'

// WEBGL1
import vert1 from '../shaders/hillshade1.vertex.glsl'
import frag1 from '../shaders/hillshade1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/hillshade2.vertex.glsl'
import frag2 from '../shaders/hillshade2.fragment.glsl'

import type { Context, HillshadeFeatureGuide, RasterSource } from '../contexts/context.spec'
import type { HillshadeData } from 'workers/worker.spec'
import type { TileGL as Tile } from 'source/tile.spec'
import type {
  HillshadeLayerDefinition,
  HillshadeLayerStyle,
  HillshadeWorkflowLayerGuide,
  LayerDefinitionBase
} from 'style/style.spec'
import type { HillshadeProgram as HillshadeProgramSpec, HillshadeProgramUniforms } from './program.spec'

export default async function sensorProgram (context: Context): Promise<HillshadeProgramSpec> {
  const Program = await import('./program').then(m => m.default)

  class HillshadeProgram extends Program implements HillshadeProgramSpec {
    texture!: WebGLTexture
    framebuffer!: WebGLFramebuffer
    layerGuides = new Map<number, HillshadeWorkflowLayerGuide>()
    declare uniforms: { [key in HillshadeProgramUniforms]: WebGLUniformLocation }
    constructor (context: Context) {
      // get gl from context
      const { gl, type } = context
      // inject Program
      super(context)
      // build shaders
      if (type === 1) this.buildShaders(vert1, frag1, { aPos: 0 })
      else this.buildShaders(vert2, frag2)
      // activate so we can setup samplers
      this.use()
      // set sampler positions
      const { uTexture } = this.uniforms
      gl.uniform1i(uTexture, 0)
      // build heatmap texture + FBO
      this.#setupFBO()
    }

    buildSource (hillshadeData: HillshadeData, tile: Tile): void {
      const { gl, context } = this
      const { image, built, size } = hillshadeData
      // do not premultiply
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
      // setup texture params
      const texture = context.buildTexture(
        built ? image as ImageBitmap : new Uint8ClampedArray(image as ArrayBuffer),
        size,
        size
      )
      // create the soruce
      const source: RasterSource = { type: 'raster', texture }
      // build features
      this.#buildFeatures(source, hillshadeData, tile)
    }

    #setupFBO (): void {
      const { gl, context } = this

      const texture = this.texture = context.buildTexture(null, gl.canvas.width, gl.canvas.height)
      // create framebuffer
      const framebuffer = gl.createFramebuffer()
      if (framebuffer === null) throw new Error('Failed to create framebuffer')
      this.framebuffer = framebuffer
      // bind framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      // attach texture
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)

      // we are finished, so go back to our main buffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }

    #buildFeatures (source: RasterSource, hillshadeData: HillshadeData, tile: Tile): void {
      const { sourceName, featureGuides } = hillshadeData
      // for each layer that maches the source, build the feature

      const features: HillshadeFeatureGuide[] = []

      for (const { code, layerIndex } of featureGuides) {
        const layerGuide = this.layerGuides.get(layerIndex)
        if (layerGuide === undefined) continue
        const { fadeDuration, lch, layerCode } = layerGuide
        let opacity = 1
        if (this.type === 1) {
          opacity = code[0]
        }
        features.push({
          type: 'hillshade',
          tile,
          source,
          sourceName,
          layerIndex,
          layerCode,
          lch,
          featureCode: code,
          fadeDuration,
          fadeStartTime: Date.now(),
          opacity
        })
      }

      tile.addFeatures(features)
    }

    buildLayerDefinition (layerBase: LayerDefinitionBase, layer: HillshadeLayerStyle): HillshadeLayerDefinition {
      const { source, layerIndex, lch } = layerBase
      // PRE) get layer properties
      let { shadowColor, accentColor, highlightColor, opacity, intensity, azimuth, fadeDuration } = layer
      shadowColor = shadowColor ?? '#000'
      accentColor = accentColor ?? '#000'
      highlightColor = highlightColor ?? '#fff'
      opacity = opacity ?? 1
      intensity = intensity ?? 1
      azimuth = azimuth ?? 0
      fadeDuration = fadeDuration ?? 300
      // 1) build definition
      const layerDefinition: HillshadeLayerDefinition = {
        ...layerBase,
        type: 'hillshade',
        shadowColor,
        accentColor,
        highlightColor,
        azimuth,
        opacity,
        intensity
      }
      // 2) Store layer workflow, building code if webgl2
      const layerCode: number[] = []
      for (const paint of [opacity, shadowColor, accentColor, highlightColor, intensity, azimuth]) {
        layerCode.push(...encodeLayerAttribute(paint, lch))
      }
      // 3) Store layer guide
      this.layerGuides.set(layerIndex, {
        sourceName: source,
        layerIndex,
        layerCode,
        lch,
        fadeDuration
      })

      return layerDefinition
    }

    setupTextureDraw (): void {
      const { gl, context, uniforms } = this
      // attach and clear framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
      // ensure null textures
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      // set draw state
      gl.uniform1f(uniforms.uDrawState, 0)
      // setup context
      context.defaultBlend()
      context.clearColorBuffer()
      context.disableCullFace()
      context.disableDepthTest()
      context.disableStencilTest()
    }

    use (): void {
      super.use()
      const { gl, context, uniforms } = this
      // set draw state
      gl.uniform1f(uniforms.uDrawState, 1)
      // setup context
      context.defaultBlend()
      context.enableDepthTest()
      context.enableCullFace()
      context.enableStencilTest()
      context.lessDepth()
    }

    draw (featureGuide: HillshadeFeatureGuide): void {
      // grab gl from the context
      const { type, gl, context, uniforms } = this
      const { uFade, uOpacity } = uniforms

      // get current source data
      const { tile, parent, source, layerIndex, featureCode, opacity } = featureGuide
      const { texture } = source
      const { mask } = parent ?? tile
      const { vao, count, offset } = mask
      context.setDepthRange(layerIndex)
      // set fade
      gl.uniform1f(uFade, 1)
      // set feature code (webgl 1 we store the opacity, webgl 2 we store layerCode lookups)
      if (type === 1) {
        gl.uniform1f(uOpacity, opacity ?? 1)
      } else { this.setFeatureCode(featureCode) }
      // bind vao
      gl.bindVertexArray(vao)
      // setup the texture
      gl.bindTexture(gl.TEXTURE_2D, texture)
      // draw elements
      gl.drawElements(gl.TRIANGLE_STRIP, count, gl.UNSIGNED_INT, offset)
    }
  }

  return new HillshadeProgram(context)
}
