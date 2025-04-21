import { Color } from 'style/color/index.js';
import Workflow from './workflow.js';

// WEBGL1
import frag1 from '../shaders/wallpaper1.fragment.glsl';
import vert1 from '../shaders/wallpaper1.vertex.glsl';
// WEBGL2
import frag2 from '../shaders/wallpaper2.fragment.glsl';
import vert2 from '../shaders/wallpaper2.vertex.glsl';

import type { ColorBlindAdjust } from 'style/color/colorBlindAdjust.js';
import type Context from '../context/context.js';
import type { Projector } from 'ui/camera/projector/index.js';
import type { StyleDefinition } from 'style/style.spec.js';
import type { VectorPoint } from 'gis-tools/index.js';
import type {
  WallpaperWorkflow as WallpaperWorkflowSpec,
  WallpaperWorkflowUniforms,
} from './workflow.spec.js';

/** Storage for a wallpaper scheme */
export interface WallpaperScheme {
  background: Color;
  fade1: Color;
  fade2: Color;
  halo: Color;
}

/** Wallpaper Workflow renders a user styled wallpaper to the GPU */
export default class WallpaperWorkflow extends Workflow implements WallpaperWorkflowSpec {
  label = 'wallpaper' as const;
  scheme: WallpaperScheme;
  tileSize = 512;
  scale: VectorPoint = { x: 0, y: 0 };
  declare uniforms: { [key in WallpaperWorkflowUniforms]: WebGLUniformLocation };
  /** @param context - WebGL(1|2) context */
  constructor(context: Context) {
    // get gl from context
    const { type } = context;
    // inject Workflow
    super(context);
    // install shaders
    if (type === 1) this.buildShaders(vert1, frag1);
    else this.buildShaders(vert2, frag2);
    // setup scheme
    this.scheme = {
      background: new Color('#000'),
      fade1: new Color('#000'),
      fade2: new Color('#000'),
      halo: new Color('#000'),
    };
  }

  /**
   * Update the scale relative to the projector's position (zoom, aspect, multiplier)
   * @param projector - Projector
   */
  #updateScale(projector: Projector): void {
    const { gl, uniforms } = this;
    const { uScale } = uniforms;
    const { min, pow } = Math;
    const { dirty, zoom, aspect, multiplier } = projector;
    if (!dirty) return;
    const radius = this.tileSize * min(pow(2, zoom), 32_768);
    const mult2 = multiplier / 2;
    const x = (this.scale.x = radius / (aspect.x / mult2));
    const y = (this.scale.y = radius / (aspect.y / mult2));
    gl.uniform2fv(uScale, [x, y]);
  }

  /**
   * Update the wallpaper style
   * @param style - input user defined style
   */
  updateStyle(style: StyleDefinition): void {
    const { scheme } = this;
    const { background, fade1, fade2, halo } = style.wallpaper ?? {};
    // inject wallpaper into scheme
    if (background !== undefined) scheme.background = new Color(background);
    if (fade1 !== undefined) scheme.fade1 = new Color(fade1);
    if (fade2 !== undefined) scheme.fade2 = new Color(fade2);
    if (halo !== undefined) scheme.halo = new Color(halo);
    // inject uniforms
    this.use();
    this.#updateUniforms();
  }

  /**
   * Update uniforms for the current colorblind mode
   * @param cbAdjust - colorblind mode
   */
  #updateUniforms(cbAdjust?: ColorBlindAdjust): void {
    const { gl, uniforms, scheme } = this;
    const { uBackground, uFade1, uFade2, uHalo } = uniforms;
    // inject uniforms
    gl.uniform4fv(uBackground, scheme.background.getRGB(true, cbAdjust));
    gl.uniform4fv(uFade1, scheme.fade1.getRGB(true, cbAdjust));
    gl.uniform4fv(uFade2, scheme.fade2.getRGB(true, cbAdjust));
    gl.uniform4fv(uHalo, scheme.halo.getRGB(true, cbAdjust));
  }

  /** Flush the uniforms to the GPU */
  override flush(): void {
    if (this.updateColorBlindMode !== null) {
      if (this.updateColorBlindMode === 0) this.#updateUniforms();
      else if (this.updateColorBlindMode === 1) this.#updateUniforms('protanopia');
      else if (this.updateColorBlindMode === 2) this.#updateUniforms('deuteranopia');
      else if (this.updateColorBlindMode === 3) this.#updateUniforms('tritanopia');
      this.updateColorBlindMode = null;
    }
  }

  /** Use this workflow as the current shaders for the GPU */
  override use(): void {
    super.use();
    const { context } = this;
    // ignore z-fighting and only pass where stencil is 0
    context.defaultBlend();
    context.disableCullFace();
    context.disableDepthTest();
    context.enableStencilTest();
    context.stencilFuncEqual(0);
  }

  /**
   * Draw the wallpaper
   * @param projector - Projector
   */
  draw(projector: Projector): void {
    // setup variables
    const { context } = this;
    // let the context know the current workflow
    context.setWorkflow(this);
    // update scale if necessary
    this.#updateScale(projector);
    // draw the wallpaper
    context.drawQuad();
  }
}
