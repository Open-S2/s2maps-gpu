import Workflow from './workflow'
import Color from 'style/color'

// WEBGL1
import vert1 from '../shaders/wallpaper1.vertex.glsl'
import frag1 from '../shaders/wallpaper1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/wallpaper2.vertex.glsl'
import frag2 from '../shaders/wallpaper2.fragment.glsl'

import type Context from '../context/context'
import type Projector from 'ui/camera/projector'
import type { WallpaperWorkflow as WallpaperWorkflowSpec, WallpaperWorkflowUniforms } from './workflow.spec'
import type { StyleDefinition } from 'style/style.spec'
import type { ColorBlindAdjust } from 'style/color/colorBlindAdjust'
import type { Point } from 'geometry'

export interface Scheme {
  background: Color
  fade1: Color
  fade2: Color
  halo: Color
}

export default class WallpaperWorkflow extends Workflow implements WallpaperWorkflowSpec {
  label = 'wallpaper' as const
  scheme: Scheme
  tileSize = 512
  scale: Point = [0, 0]
  declare uniforms: { [key in WallpaperWorkflowUniforms]: WebGLUniformLocation }
  constructor (context: Context) {
    // get gl from context
    const { type } = context
    // inject Workflow
    super(context)
    // install shaders
    if (type === 1) this.buildShaders(vert1, frag1)
    else this.buildShaders(vert2, frag2)
    // setup scheme
    this.scheme = {
      background: new Color('#000'),
      fade1: new Color('#000'),
      fade2: new Color('#000'),
      halo: new Color('#000')
    }
  }

  #updateScale (projector: Projector): void {
    const { gl, uniforms } = this
    const { uScale } = uniforms
    const { min, pow } = Math
    const { dirty, zoom, aspect, multiplier } = projector
    if (!dirty) return
    const radius = this.tileSize * min(pow(2, zoom), 32_768)
    const mult2 = multiplier / 2
    this.scale[0] = radius / (aspect[0] / mult2)
    this.scale[1] = radius / (aspect[1] / mult2)
    gl.uniform2fv(uScale, this.scale)
  }

  updateStyle (style: StyleDefinition): void {
    const { scheme } = this
    const { background, fade1, fade2, halo } = style.wallpaper ?? {}
    // inject wallpaper into scheme
    if (background !== undefined) scheme.background = new Color(background)
    if (fade1 !== undefined) scheme.fade1 = new Color(fade1)
    if (fade2 !== undefined) scheme.fade2 = new Color(fade2)
    if (halo !== undefined) scheme.halo = new Color(halo)
    // inject uniforms
    this.use()
    this.#updateUniforms()
  }

  #updateUniforms (cbAdjust?: ColorBlindAdjust): void {
    const { gl, uniforms, scheme } = this
    const { uBackground, uFade1, uFade2, uHalo } = uniforms
    // inject uniforms
    gl.uniform4fv(uBackground, scheme.background.getRGB(true, cbAdjust))
    gl.uniform4fv(uFade1, scheme.fade1.getRGB(true, cbAdjust))
    gl.uniform4fv(uFade2, scheme.fade2.getRGB(true, cbAdjust))
    gl.uniform4fv(uHalo, scheme.halo.getRGB(true, cbAdjust))
  }

  flush (): void {
    if (this.updateColorBlindMode !== null) {
      if (this.updateColorBlindMode === 0) this.#updateUniforms()
      else if (this.updateColorBlindMode === 1) this.#updateUniforms('protanopia')
      else if (this.updateColorBlindMode === 2) this.#updateUniforms('deuteranopia')
      else if (this.updateColorBlindMode === 3) this.#updateUniforms('tritanopia')
      this.updateColorBlindMode = null
    }
  }

  use (): void {
    super.use()
    const { context } = this
    // ignore z-fighting and only pass where stencil is 0
    context.defaultBlend()
    context.disableCullFace()
    context.disableDepthTest()
    context.enableStencilTest()
    context.stencilFuncEqual(0)
  }

  draw (projector: Projector): void {
    // setup variables
    const { context } = this
    // let the context know the current workflow
    context.setWorkflow(this)
    // update scale if necessary
    this.#updateScale(projector)
    // draw the wallpaper
    context.drawQuad()
  }
}