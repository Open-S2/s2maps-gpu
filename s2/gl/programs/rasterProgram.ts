import encodeLayerAttribute from './util/encodeLayerAttribute'

// WEBGL1
import vert1 from '../shaders/raster1.vertex.glsl'
import frag1 from '../shaders/raster1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/raster2.vertex.glsl'
import frag2 from '../shaders/raster2.fragment.glsl'

import type { Context, RasterFeatureGuide, RasterSource } from '../contexts'
import type { RasterProgram as RasterProgramSpec, RasterProgramUniforms } from './program.spec'
import type { TileGL as Tile } from '../../source/tile.spec'
import type { RasterData } from '../../workers/worker.spec'
import type {
  LayerDefinitionBase,
  LayerStyle,
  RasterLayerDefinition,
  RasterLayerStyle,
  RasterWorkflowLayerGuide,
  Resampling
} from '../../style/style.spec'

export default async function rasterProgram (context: Context): Promise<RasterProgramSpec> {
  const Program = await import('./program').then(m => m.default)

  class RasterProgram extends Program implements RasterProgramSpec {
    curSample: 'none' | 'linear' | 'nearest' = 'none'
    layerGuides: Map<number, RasterWorkflowLayerGuide> = new Map()
    declare uniforms: { [key in RasterProgramUniforms]: WebGLUniformLocation }
    constructor (context: Context) {
      // get gl from context
      const { type } = context
      // inject Program
      super(context)
      // build shaders
      if (type === 1) this.buildShaders(vert1, frag1, { aPos: 0 })
      else this.buildShaders(vert2, frag2)
    }

    #setSampleType (type: Resampling): void {
      const { curSample, gl } = this
      if (curSample === type) return
      this.curSample = type
      if (type === 'nearest') {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      }
    }

    // programs helps design the appropriate layer parameters
    buildLayerDefinition (layerBase: LayerDefinitionBase, layer: LayerStyle): RasterLayerDefinition {
      const { source, layerIndex, lch } = layerBase
      // PRE) get layer base
      let { paint } = layer as RasterLayerStyle
      if (paint === undefined) paint = {}
      let { opacity, saturation, contrast, resampling } = paint
      const fadeDuration = paint['fade-duration'] ?? 300
      resampling = resampling ?? 'linear'
      // 1) build definition
      const layerDefinition: RasterLayerDefinition = {
        type: 'raster',
        ...layerBase,
        paint: {
          opacity: opacity ?? 1,
          saturation: saturation ?? 0,
          contrast: contrast ?? 0
        }
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
        resampling,
        fadeDuration
      })

      return layerDefinition
    }

    buildSource (rasterData: RasterData, tile: Tile): void {
      const { gl, context } = this
      const { image, built, size } = rasterData
      // do not premultiply
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
      // setup texture params
      const texture = context.buildTexture(
        built ? image as ImageBitmap : new Uint8ClampedArray(image as ArrayBuffer),
        size,
        size
      )

      // Extend mask
      const rasterSource: RasterSource = {
        type: 'raster',
        texture
      }

      this.#buildFeatures(rasterSource, rasterData, tile)
    }

    #buildFeatures (source: RasterSource, rasterData: RasterData, tile: Tile): void {
      const { sourceName, featureGuides } = rasterData
      // for each layer that maches the source, build the feature

      const features: RasterFeatureGuide[] = []

      for (const { code, layerIndex } of featureGuides) {
        const layerGuide = this.layerGuides.get(layerIndex)
        if (layerGuide === undefined) continue
        const { resampling, fadeDuration, lch, layerCode } = layerGuide
        let opacity = 1
        let saturation = 0
        let contrast = 0
        if (this.type === 1) {
          opacity = code[0]
          saturation = code[1]
          contrast = code[2]
        }
        features.push({
          type: 'raster',
          tile,
          source,
          sourceName,
          layerIndex,
          layerCode,
          lch,
          featureCode: code,
          resampling,
          fadeDuration,
          fadeStartTime: Date.now(),
          opacity,
          saturation,
          contrast
        })
      }

      tile.addFeatures(features)
    }

    use (): void {
      context.defaultBlend()
      context.enableDepthTest()
      context.enableCullFace()
      context.enableStencilTest()
      context.lessDepth()
      super.use()
    }

    draw (featureGuide: RasterFeatureGuide, _interactive = false): void {
      // grab gl from the context
      const { type, gl, context, uniforms } = this
      const { uFade, uOpacity, uContrast, uSaturation } = uniforms

      // get current source data
      const {
        tile, parent, source, layerIndex, featureCode,
        opacity, contrast, saturation, resampling
      } = featureGuide
      const { texture } = source
      const { mask } = parent ?? tile
      const { vao, count, offset } = mask
      context.setDepthRange(layerIndex)
      // set fade
      gl.uniform1f(uFade, 1)
      // set feature code (webgl 1 we store the opacity, webgl 2 we store layerCode lookups)
      if (type === 1) {
        gl.uniform1f(uOpacity, opacity ?? 1)
        gl.uniform1f(uContrast, contrast ?? 0)
        gl.uniform1f(uSaturation, saturation ?? 0)
      } else { this.setFeatureCode(featureCode) }
      // bind vao
      gl.bindVertexArray(vao)
      // setup the texture
      gl.bindTexture(gl.TEXTURE_2D, texture)
      this.#setSampleType(resampling)
      // draw elements
      gl.drawElements(gl.TRIANGLE_STRIP, count, gl.UNSIGNED_INT, offset)
    }
  }

  return new RasterProgram(context)
}
