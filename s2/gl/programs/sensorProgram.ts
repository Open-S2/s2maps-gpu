import encodeLayerAttribute from './util/encodeLayerAttribute'
import { buildColorRamp } from 's2/style/buildColorRamp'

// WEBGL1
import vert1 from '../shaders/sensors1.vertex.glsl'
import frag1 from '../shaders/sensors1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/sensors2.vertex.glsl'
import frag2 from '../shaders/sensors2.fragment.glsl'

import type { Context, SensorFeatureGuide, SensorSource } from '../contexts/context.spec'
import type { SensorData } from 's2/workers/worker.spec'
import type { TileGL as Tile } from 's2/source/tile.spec'
import type {
  LayerDefinitionBase,
  LayerStyle,
  SensorLayerDefinition,
  SensorLayerStyle,
  SensorWorkflowLayerGuide
} from 's2/style/style.spec'
import type { SensorProgram as SensorProgramSpec, SensorProgramUniforms } from './program.spec'
import type TimeCache from 's2/ui/camera/timeCache'
import type { SensorTextureDefinition } from 's2/ui/camera/timeCache'

export default async function sensorProgram (context: Context): Promise<SensorProgramSpec> {
  const Program = await import('./program').then(m => m.default)

  class SensorProgram extends Program implements SensorProgramSpec {
    nullTexture!: WebGLTexture
    timeCache?: TimeCache
    layerGuides = new Map<number, SensorWorkflowLayerGuide>()
    declare uniforms: { [key in SensorProgramUniforms]: WebGLUniformLocation }
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
      const { uColorRamp, uImage, uNextImage } = this.uniforms
      gl.uniform1i(uColorRamp, 0)
      gl.uniform1i(uImage, 1)
      gl.uniform1i(uNextImage, 2)
      // set a null texture
      this.#createNullTexture()
    }

    #createNullTexture (): void {
      const { gl } = this
      const texture = gl.createTexture()
      if (texture === null) throw new Error('Failed to create sensor null texture')
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      this.nullTexture = texture
    }

    injectTimeCache (timeCache: TimeCache): void {
      this.timeCache = timeCache
    }

    buildSource (sensorData: SensorData, tile: Tile): void {
      const { gl, context } = this
      const { image, built, sourceName, size, time } = sensorData
      // do not premultiply
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
      // setup texture params
      const texture = context.buildTexture(
        built ? image as ImageBitmap : new Uint8ClampedArray(image as ArrayBuffer),
        size,
        size
      )

      // Extend mask
      const sensorSource: SensorSource = {
        texture
      }
      // inject source into timeCache
      this.timeCache?.addSourceData(tile.id, time, sourceName, sensorSource)

      this.#buildFeatures(sensorData, tile)
    }

    #buildFeatures (rasterData: SensorData, tile: Tile): void {
      const { timeCache } = this
      const { sourceName, featureGuides } = rasterData
      // for each layer that maches the source, build the feature

      const features: SensorFeatureGuide[] = []

      for (const { code, layerIndex } of featureGuides) {
        const layerGuide = this.layerGuides.get(layerIndex)
        if (layerGuide === undefined) continue
        const { fadeDuration, colorRamp, lch, layerCode } = layerGuide
        let opacity = 1
        if (this.type === 1) {
          opacity = code[0]
        }
        features.push({
          type: 'sensor',
          tile,
          sourceName,
          layerIndex,
          layerCode,
          lch,
          featureCode: code,
          fadeDuration,
          fadeStartTime: Date.now(),
          colorRamp,
          opacity,
          getTextures: (): SensorTextureDefinition => { return timeCache?.getTextures(tile.id, sourceName) ?? {} }
        })
      }

      tile.addFeatures(features)
    }

    buildLayerDefinition (layerBase: LayerDefinitionBase, layer: LayerStyle): SensorLayerDefinition {
      const { source, layerIndex, lch } = layerBase
      // PRE) get layer base
      let { paint, layout } = layer as SensorLayerStyle
      if (paint === undefined) paint = {}
      const colorRamp = layout?.colorRamp ?? 'sinebow'
      let { opacity } = paint
      opacity = opacity ?? 1
      const fadeDuration = paint['fade-duration'] ?? 300
      // 1) build definition
      const layerDefinition: SensorLayerDefinition = {
        type: 'raster',
        ...layerBase,
        paint: { opacity }
      }
      // 2) Store layer workflow, building code if webgl2
      const layerCode: number[] = []
      layerCode.push(...encodeLayerAttribute(opacity, lch))
      this.layerGuides.set(layerIndex, {
        sourceName: source,
        layerIndex,
        layerCode,
        lch,
        fadeDuration,
        colorRamp: context.buildTexture(buildColorRamp(colorRamp, lch), 256, 4)
      })

      return layerDefinition
    }

    use (): void {
      context.oneBlend()
      context.enableDepthTest()
      context.enableCullFace()
      context.enableStencilTest()
      context.lessDepth()
      super.use()
    }

    draw (featureGuide: SensorFeatureGuide, _interactive = false): void {
      // grab gl from the context
      const { gl, type, context, nullTexture, uniforms } = this
      const { uTime, uOpacity } = uniforms

      // get current source data. Time is a uniform
      const { tile, parent, featureCode, colorRamp, opacity, layerIndex } = featureGuide
      const { time, texture, textureNext } = featureGuide.getTextures()
      const { mask } = parent ?? tile
      const { vao, count, offset } = mask
      if (time === undefined || texture === undefined) return
      context.setDepthRange(layerIndex)
      // set feature code (webgl 1 we store the opacity, webgl 2 we store layerCode lookups)
      if (type === 1) {
        gl.uniform1f(uOpacity, opacity ?? 1)
      } else { this.setFeatureCode(featureCode) }
      // set time uniform
      gl.uniform1f(uTime, time)
      // setup the textures
      gl.activeTexture(gl.TEXTURE2) // uNextImage
      if (textureNext !== undefined) gl.bindTexture(gl.TEXTURE_2D, textureNext)
      else gl.bindTexture(gl.TEXTURE_2D, nullTexture)
      gl.activeTexture(gl.TEXTURE1) // uImage
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.activeTexture(gl.TEXTURE0) // uColorRamp
      gl.bindTexture(gl.TEXTURE_2D, colorRamp)
      // draw elements
      gl.bindVertexArray(vao)
      gl.drawElements(gl.TRIANGLE_STRIP, count, gl.UNSIGNED_INT, offset)
    }
  }

  return new SensorProgram(context)
}
