import Workflow from './workflow'
import encodeLayerAttribute from 'style/encodeLayerAttribute'
import { buildColorRamp } from 'style/color'

// WEBGL1
import vert1 from '../shaders/heatmap1.vertex.glsl'
import frag1 from '../shaders/heatmap1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/heatmap2.vertex.glsl'
import frag2 from '../shaders/heatmap2.fragment.glsl'

import type Context from '../context/context'
import type { HeatmapData } from 'workers/worker.spec'
import type { TileGL as Tile } from 'source/tile.spec'
import type {
  BBox,
  HeatmapDefinition,
  HeatmapStyle,
  HeatmapWorkflowLayerGuide,
  LayerDefinitionBase
} from 'style/style.spec'
import type {
  HeatmapFeature as HeatmapFeatureSpec,
  HeatmapSource,
  HeatmapWorkflow as HeatmapWorkflowSpec,
  HeatmapWorkflowUniforms
} from './workflow.spec'

export class HeatmapFeature implements HeatmapFeatureSpec {
  type = 'heatmap' as const
  radiusLo?: number // webgl1
  opacityLo?: number // webgl1
  intensityLo?: number // webgl1
  radiusHi?: number // webgl1
  opacityHi?: number // webgl1
  intensityHi?: number // webgl1
  constructor (
    public workflow: HeatmapWorkflow,
    public source: HeatmapSource,
    public layerGuide: HeatmapWorkflowLayerGuide,
    public tile: Tile,
    public count: number,
    public offset: number,
    public featureCode: number[] = [0],
    public parent?: Tile,
    public bounds?: BBox
  ) {}

  draw (interactive?: boolean): void {
    const { tile, workflow } = this
    workflow.context.stencilFuncEqual(tile.tmpMaskID)
    workflow.draw(this, interactive)
  }

  destroy (): void {}

  duplicate (tile: Tile, parent?: Tile, bounds?: BBox): HeatmapFeature {
    const {
      workflow, source, layerGuide, count, offset, featureCode,
      radiusLo, opacityLo, intensityLo, radiusHi, opacityHi, intensityHi
    } = this
    const newFeature = new HeatmapFeature(
      workflow, source, layerGuide, tile, count, offset, featureCode,
      parent, bounds
    )
    newFeature.setWebGL1Attributes(radiusLo, opacityLo, intensityLo, radiusHi, opacityHi, intensityHi)
    return newFeature
  }

  setWebGL1Attributes (
    radiusLo?: number,
    opacityLo?: number,
    intensityLo?: number,
    radiusHi?: number,
    opacityHi?: number,
    intensityHi?: number
  ): void {
    this.radiusLo = radiusLo
    this.opacityLo = opacityLo
    this.intensityLo = intensityLo
    this.radiusHi = radiusHi
    this.opacityHi = opacityHi
    this.intensityHi = intensityHi
  }
}

export default class HeatmapWorkflow extends Workflow implements HeatmapWorkflowSpec {
  texture!: WebGLTexture
  nullTextureA!: WebGLTexture
  nullTextureB!: WebGLTexture
  framebuffer!: WebGLFramebuffer
  extentBuffer?: WebGLBuffer
  layerGuides = new Map<number, HeatmapWorkflowLayerGuide>()
  declare uniforms: { [key in HeatmapWorkflowUniforms]: WebGLUniformLocation }
  constructor (context: Context) {
    // get gl from context
    const { gl, type, devicePixelRatio } = context
    // inject Program
    super(context)
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1, { aExtent: 0, aPos: 1, aWeight: 2 })
    else this.buildShaders(vert2, frag2)
    // activate so we can setup samplers
    this.use()
    // set device pixel ratio
    this.setDevicePixelRatio(devicePixelRatio)
    // set sampler positions
    const { uColorRamp, uImage } = this.uniforms
    gl.uniform1i(uColorRamp, 0)
    gl.uniform1i(uImage, 1)
    // build heatmap texture + FBO
    this.#setupFBO()
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

  buildSource (heatmapData: HeatmapData, tile: Tile): void {
    const { gl, context } = this
    const { featureGuideBuffer } = heatmapData
    // prep buffers
    const vertexA = new Float32Array(heatmapData.vertexBuffer)
    const weightA = new Float32Array(heatmapData.weightBuffer)
    // Create a starting vertex array object (attribute state)
    const vao = context.buildVAO()

    // bind buffers to the vertex array object
    // Create the feature index buffer
    const vertexBuffer = context.bindEnableVertexAttr(vertexA, 1, 2, gl.FLOAT, false, 8, 0, true)
    const weightBuffer = context.bindEnableVertexAttr(weightA, 2, 1, gl.FLOAT, false, 4, 0, true)
    this.#bindExtentBuffer()

    const source: HeatmapSource = {
      type: 'heatmap',
      vertexBuffer,
      weightBuffer,
      vao
    }

    context.cleanup() // flush vao

    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer))
  }

  #buildFeatures (source: HeatmapSource, tile: Tile, featureGuideArray: Float32Array): void {
    const features: HeatmapFeatureSpec[] = []

    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4)
      i += 4
      // grab the layerGuide
      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      // create the feature and set the correct properties
      const feature = new HeatmapFeature(this, source, layerGuide, tile, count, offset)
      if (this.type === 1) {
        const [rLo, oLo, iLo, rHi, oHi, iHi] = featureGuideArray.slice(i, i + 6)
        feature.setWebGL1Attributes(rLo, oLo, iLo, rHi, oHi, iHi)
      } else if (this.type === 2 && encodingSize > 0) {
        feature.featureCode = [...featureGuideArray.slice(i, i + encodingSize)]
      }
      features.push(feature)
      // update index
      i += encodingSize
    }

    tile.addFeatures(features)
  }

  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: HeatmapStyle): HeatmapDefinition {
    const { type, context } = this
    const { source, layerIndex, lch, visible } = layerBase
    // PRE) get layer base
    let {
      // paint
      radius, opacity, intensity,
      // layout
      colorRamp, weight
    } = layer
    radius = radius ?? 1
    opacity = opacity ?? 1
    intensity = intensity ?? 1
    colorRamp = colorRamp ?? 'sinebow'
    // 1) build definition
    const layerDefinition: HeatmapDefinition = {
      ...layerBase,
      type: 'heatmap',
      // paint
      radius,
      opacity,
      intensity,
      // layout
      colorRamp,
      weight: weight ?? 1
    }
    // 2) Store layer workflow, building code if webgl2
    const layerCode: number[] = []
    if (type === 2) {
      for (const paint of [radius, opacity, intensity]) {
        layerCode.push(...encodeLayerAttribute(paint, lch))
      }
    }
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      colorRamp: context.buildTexture(buildColorRamp(colorRamp, lch), 256, 4),
      visible,
      interactive: false,
      opaque: false
    })

    return layerDefinition
  }

  #setupFBO (): void {
    const { gl, context } = this

    this.nullTextureA = context.buildTexture(null, 1)
    this.nullTextureB = context.buildTexture(null, 1)

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

  resize (): void {
    const { gl, context } = this
    context.updateTexture(this.texture, null, gl.canvas.width, gl.canvas.height)
  }

  setupTextureDraw (): void {
    const { gl, context, uniforms } = this
    // attach and clear framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    // ensure null textures
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.nullTextureA)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.nullTextureB)
    // set draw state
    gl.uniform1f(uniforms.uDrawState, 0)
    // setup context
    context.clearColorBuffer()
    context.oneBlend()
    context.disableCullFace()
    context.disableDepthTest()
    context.disableStencilTest()
  }

  use (): void {
    super.use()
    const { gl, context, uniforms } = this
    // set draw state
    gl.uniform1f(uniforms.uDrawState, 1)
    // revert back to texture 0
    gl.activeTexture(gl.TEXTURE0)
    // setup context
    context.defaultBlend()
    context.enableDepthTest()
    context.enableStencilTest()
    context.disableCullFace()
    context.lessDepth()
  }

  drawTexture (featureGuide: HeatmapFeatureSpec): void {
    // grab context
    const { context, uniforms } = this
    const { gl, type, defaultBounds } = context
    // get current source data
    const { count, offset, source, featureCode, bounds } = featureGuide
    const { radiusLo, opacityLo, intensityLo, radiusHi, opacityHi, intensityHi } = featureGuide
    const { uRadiusLo, uOpacityLo, uIntensityLo, uRadiusHi, uOpacityHi, uIntensityHi, uBounds } = uniforms
    const { vao, vertexBuffer, weightBuffer } = source
    // set feature code (webgl 1 we store the colors, webgl 2 we store layerCode lookups)
    if (type === 1) {
      gl.uniform1f(uRadiusLo, radiusLo ?? 1)
      gl.uniform1f(uOpacityLo, opacityLo ?? 1)
      gl.uniform1f(uIntensityLo, intensityLo ?? 1)
      gl.uniform1f(uRadiusHi, radiusHi ?? 1)
      gl.uniform1f(uOpacityHi, opacityHi ?? 1)
      gl.uniform1f(uIntensityHi, intensityHi ?? 1)
    } else { this.setFeatureCode(featureCode) }
    // if bounds exists, set them, otherwise set default bounds
    if (bounds !== undefined) gl.uniform4fv(uBounds, bounds)
    else gl.uniform4fv(uBounds, defaultBounds)
    // setup offsets and draw
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 8, offset * 8)
    gl.bindBuffer(gl.ARRAY_BUFFER, weightBuffer)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 4, offset * 4)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count)
  }

  draw (featureGuide: HeatmapFeatureSpec, _interactive = false): void {
    // grab the context
    const { gl, context } = this
    const { vao } = context
    // get current featureGuide data
    const { layerGuide: { layerIndex, visible, colorRamp } } = featureGuide
    if (!visible) return
    // set context's full screen fbo
    gl.bindVertexArray(vao)
    // set colorRamp
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, colorRamp)
    // adjust context
    context.stencilFuncAlways(0)
    context.setDepthRange(layerIndex)
    // draw a fan
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
  }

  delete (): void {
    const { gl, texture, framebuffer } = this
    // delete texture
    gl.deleteTexture(texture)
    // delete framebuffer
    gl.deleteFramebuffer(framebuffer)
    // cleanup
    super.delete()
  }
}
