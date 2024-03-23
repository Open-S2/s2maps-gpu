import { Feature } from './workflow'
import encodeLayerAttribute from 'style/encodeLayerAttribute'
import { buildColorRamp } from 'style/color'

// WEBGL1
import vert1 from '../shaders/sensors1.vertex.glsl'
import frag1 from '../shaders/sensors1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/sensors2.vertex.glsl'
import frag2 from '../shaders/sensors2.fragment.glsl'

import type Context from '../context/context'
import type { SensorData } from 'workers/worker.spec'
import type { TileGL as Tile } from 'source/tile.spec'
import type {
  LayerDefinitionBase,
  SensorDefinition,
  SensorStyle,
  SensorWorkflowLayerGuide
} from 'style/style.spec'
import type {
  SensorFeature as SensorFeatureSpec,
  SensorSource,
  SensorWorkflow as SensorWorkflowSpec,
  SensorWorkflowUniforms
} from './workflow.spec'
import type TimeCache from 'ui/camera/timeCache'
import type { SensorTextureDefinition } from 'ui/camera/timeCache'

export class SensorFeature extends Feature implements SensorFeatureSpec {
  type = 'sensor' as const
  opacity?: number // webgl1
  constructor (
    public layerGuide: SensorWorkflowLayerGuide,
    public workflow: SensorWorkflowSpec,
    public featureCode: number[],
    public tile: Tile,
    public fadeStartTime = Date.now(),
    public parent?: Tile
  ) {
    super(workflow, tile, layerGuide, featureCode, parent)
  }

  draw (interactive = false): void {
    super.draw(interactive)
    this.workflow.draw(this, interactive)
  }

  duplicate (tile: Tile, parent?: Tile): SensorFeature {
    const {
      layerGuide, workflow, featureCode, fadeStartTime,
      opacity
    } = this
    const newFeature = new SensorFeature(
      layerGuide, workflow, featureCode, tile, fadeStartTime, parent
    )
    newFeature.setWebGL1Attributes(opacity)
    return newFeature
  }

  getTextures (): SensorTextureDefinition {
    const { tile: { id }, workflow: { timeCache }, layerGuide: { sourceName } } = this
    return timeCache?.getTextures(id, sourceName) ?? {}
  }

  setWebGL1Attributes (
    opacity?: number
  ): void {
    this.opacity = opacity
  }
}

export default async function sensorWorkflow (context: Context): Promise<SensorWorkflowSpec> {
  const Workflow = await import('./workflow').then(m => m.default)

  class SensorWorkflow extends Workflow implements SensorWorkflowSpec {
    label = 'sensor' as const
    nullTexture!: WebGLTexture
    timeCache?: TimeCache
    layerGuides = new Map<number, SensorWorkflowLayerGuide>()
    declare uniforms: { [key in SensorWorkflowUniforms]: WebGLUniformLocation }
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
      const { image, sourceName, size, time } = sensorData
      // do not premultiply
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
      // setup texture params
      const texture = context.buildTexture(image, size)

      // Extend mask
      const sensorSource: SensorSource = {
        texture
      }
      // inject source into timeCache
      this.timeCache?.addSourceData(tile.id, time, sourceName, sensorSource)

      this.#buildFeatures(sensorData, tile)
    }

    #buildFeatures (rasterData: SensorData, tile: Tile): void {
      const { featureGuides } = rasterData
      const features: SensorFeatureSpec[] = []
      // for each layer that maches the source, build the feature
      for (const { code, layerIndex } of featureGuides) {
        const layerGuide = this.layerGuides.get(layerIndex)
        if (layerGuide === undefined) continue
        const feature = new SensorFeature(layerGuide, this, [0], tile)
        if (this.type === 1) feature.setWebGL1Attributes(code[0])
        features.push(feature)
      }

      tile.addFeatures(features)
    }

    buildLayerDefinition (layerBase: LayerDefinitionBase, layer: SensorStyle): SensorDefinition {
      const { source, layerIndex, lch, visible, interactive } = layerBase
      // PRE) get layer properties
      let { colorRamp, opacity, fadeDuration, cursor } = layer
      opacity = opacity ?? 1
      colorRamp = colorRamp ?? 'sinebow'
      fadeDuration = fadeDuration ?? 300
      // 1) build definition
      const layerDefinition: SensorDefinition = {
        ...layerBase,
        type: 'sensor',
        opacity,
        colorRamp,
        fadeDuration,
        interactive: interactive ?? false,
        cursor: cursor ?? 'default'
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
        colorRamp: context.buildTexture(buildColorRamp(colorRamp, lch), 256, 4),
        visible,
        interactive: interactive ?? false,
        opaque: false
      })

      return layerDefinition
    }

    use (): void {
      super.use()
      context.oneBlend()
      context.enableDepthTest()
      context.enableCullFace()
      context.enableStencilTest()
      context.lessDepth()
    }

    draw (featureGuide: SensorFeatureSpec, _interactive = false): void {
      // grab gl from the context
      const { gl, type, context, nullTexture, uniforms } = this
      const { uTime, uOpacity } = uniforms

      // get current source data. Time is a uniform
      const {
        tile, parent, featureCode, opacity,
        layerGuide: { layerIndex, visible, colorRamp }
      } = featureGuide
      if (!visible) return
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

  return new SensorWorkflow(context)
}
