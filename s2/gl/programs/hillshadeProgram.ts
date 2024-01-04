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
  LayerDefinitionBase,
  UnpackData
} from 'style/style.spec'
import type { HillshadeProgram as HillshadeProgramSpec, HillshadeProgramUniforms } from './program.spec'

export default async function hillshadeProgram (context: Context): Promise<HillshadeProgramSpec> {
  const Program = await import('./program').then(m => m.default)

  class HillshadeProgram extends Program implements HillshadeProgramSpec {
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
    }

    buildSource (hillshadeData: HillshadeData, tile: Tile): void {
      const { gl, context } = this
      const { image, built, size } = hillshadeData
      // do not premultiply
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
      // setup texture params
      const texture = context.buildTexture(
        built ? image as ImageBitmap : new Uint8ClampedArray(image as ArrayBuffer),
        size
      )
      // create the soruce
      const source: RasterSource = { type: 'raster', texture, size }
      // build features
      this.#buildFeatures(source, hillshadeData, tile)
    }

    #buildFeatures (source: RasterSource, hillshadeData: HillshadeData, tile: Tile): void {
      const { sourceName, featureGuides } = hillshadeData
      // for each layer that maches the source, build the feature

      const features: HillshadeFeatureGuide[] = []

      for (const { code, layerIndex } of featureGuides) {
        const layerGuide = this.layerGuides.get(layerIndex)
        if (layerGuide === undefined) continue
        const { fadeDuration, lch, layerCode, unpack } = layerGuide
        let opacity = 1
        let shadowColor: [number, number, number, number] | undefined
        let accentColor: [number, number, number, number] | undefined
        let highlightColor: [number, number, number, number] | undefined
        let azimuth: number | undefined
        let altitude: number | undefined
        if (this.type === 1) {
          opacity = code[0]
          shadowColor = code.slice(1, 5) as [number, number, number, number]
          accentColor = code.slice(5, 9) as [number, number, number, number]
          highlightColor = code.slice(9, 13) as [number, number, number, number]
          azimuth = code[13]
          altitude = code[14]
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
          opacity,
          shadowColor,
          accentColor,
          highlightColor,
          azimuth,
          altitude,
          unpack
        })
      }

      tile.addFeatures(features)
    }

    buildLayerDefinition (layerBase: LayerDefinitionBase, layer: HillshadeLayerStyle): HillshadeLayerDefinition {
      const { type } = this
      const { source, layerIndex, lch } = layerBase
      // PRE) get layer properties
      let { unpack, shadowColor, accentColor, highlightColor, opacity, azimuth, altitude, fadeDuration } = layer
      shadowColor = shadowColor ?? '#000'
      accentColor = accentColor ?? '#000'
      highlightColor = highlightColor ?? '#fff'
      opacity = opacity ?? 1
      azimuth = azimuth ?? 315
      altitude = altitude ?? 45
      fadeDuration = fadeDuration ?? 300
      // defaults to mapbox unpack
      unpack = unpack ?? { offset: -10000, zFactor: 0.1, aMultiplier: 0, bMultiplier: 1, gMultiplier: 256, rMultiplier: 256 * 256 }
      // 1) build definition
      const layerDefinition: HillshadeLayerDefinition = {
        ...layerBase,
        type: 'hillshade',
        shadowColor,
        accentColor,
        highlightColor,
        azimuth,
        altitude,
        opacity,
        unpack
      }
      // 2) Store layer workflow, building code if webgl2
      const layerCode: number[] = []
      if (type === 2) {
        for (const paint of [opacity, shadowColor, accentColor, highlightColor, azimuth, altitude]) {
          layerCode.push(...encodeLayerAttribute(paint, lch))
        }
      }
      // 3) Store layer guide
      const unpackData: UnpackData = [unpack.offset, unpack.zFactor, unpack.rMultiplier, unpack.gMultiplier, unpack.bMultiplier, unpack.aMultiplier]
      this.layerGuides.set(layerIndex, {
        sourceName: source,
        layerIndex,
        layerCode,
        lch,
        fadeDuration,
        unpack: unpackData
      })

      return layerDefinition
    }

    use (): void {
      super.use()
      const { context } = this
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
      const { uFade, uTexLength, uUnpack, uOpacity, uShadowColor, uAccentColor, uHighlightColor, uAzimuth, uAltitude } = uniforms
      const { PI, min, max } = Math

      // get current source data
      const {
        tile, parent, source, layerIndex, featureCode, unpack,
        opacity, shadowColor, accentColor, highlightColor, azimuth, altitude
      } = featureGuide
      const { texture, size } = source
      const { vao, count, offset } = (parent ?? tile).mask
      context.setDepthRange(layerIndex)
      // set fade
      gl.uniform1f(uFade, 1)
      gl.uniform1fv(uUnpack, unpack)
      // set feature code (webgl 1 we store the opacity, webgl 2 we store layerCode lookups)
      if (type === 1) {
        gl.uniform1f(uTexLength, size)
        gl.uniform1f(uOpacity, opacity ?? 1)
        gl.uniform4fv(uShadowColor, shadowColor ?? [0, 0, 0, 1])
        gl.uniform4fv(uAccentColor, accentColor ?? [0, 0, 0, 1])
        gl.uniform4fv(uHighlightColor, highlightColor ?? [1, 1, 1, 1])
        gl.uniform1f(uAzimuth, min(max(azimuth ?? 315, 0), 360) * PI / 180)
        gl.uniform1f(uAltitude, min(max(altitude ?? 45, 0), 90) / 90)
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
