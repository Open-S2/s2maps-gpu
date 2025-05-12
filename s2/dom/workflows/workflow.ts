import type { ColorMode } from 's2/s2Map.js';
import type { DOMContext } from '../context.js';
import type { TileDOM as Tile } from 'source/tile.spec.js';
import type { BBox, VectorPoint } from 'gis-tools/index.js';
import type {
  FeatureBase,
  LayerGuides,
  Workflow as WorkflowFeature,
  WorkflowSpec,
} from './workflow.spec.js';

/** A Generic Feature that can be drawn to the GPU */
export class Feature implements FeatureBase {
  /**
   * @param workflow - the input workflow
   * @param tile - the tile that the feature is drawn on
   * @param layerGuide - the layer guide
   * @param featureCode - the feature code that tells the GPU how to compute it's properties
   * @param parent - the parent tile if applicable
   * @param bounds - the bounds of the tile if applicable
   */
  constructor(
    public workflow: WorkflowFeature,
    public tile: Tile,
    public layerGuide: LayerGuides,
    public featureCode: number[] = [0],
    public parent?: Tile,
    public bounds?: BBox,
  ) {}

  /**
   * Draw the feature to the GPU
   * @param interactive - whether or not the feature is interactive
   */
  draw(interactive = false): void {
    const { tile, parent, workflow, layerGuide } = this;
    const { layerIndex, layerCode, lch } = layerGuide;
    // let the context know the current workflow
    workflow.context.setWorkflow(workflow);
    // ensure the tile information is set
    workflow.setTileUniforms(tile, parent);
    // set layer code
    workflow.setLayerCode(layerIndex, layerCode, lch);
    // set interactive if applicable
    workflow.setInteractive(interactive);
  }

  /** Destroy the feature */
  destroy(): void {}
}

/** Generic Workflow used by most workflows */
export default class Workflow implements WorkflowSpec {
  vertexShader!: WebGLShader;
  fragmentShader!: WebGLShader;
  radii = false;
  context: DOMContext;
  type = 0 as const;
  updateColorBlindMode: null | ColorMode = null;
  updateMatrix: null | Float32Array = null; // pointer
  updateInputs: null | Float32Array = null; // pointer
  updateAspect: null | VectorPoint = null; // pointer
  curLayer = -1;
  curMode = -1;
  curTile = -1n;
  LCH?: boolean;
  interactive?: boolean;
  uniforms!: Record<string, WebGLUniformLocation>;

  /**
   * @param context - the context to use that tracks the GPU state
   */
  constructor(context: DOMContext) {
    // set context
    this.context = context;
  }

  /** Delete the workflow and it's shaders */
  delete(): void {}

  /** Activate this workflow as the current shaders for the GPU */
  use(): void {
    // reset tile tracker since it impacts wether we update our matrix or not
    this.curTile = -1n;
    this.flush();
  }

  /**
   * Inject uniforms that are common to the frame
   * @param matrix - the projection matrix
   * @param view - the view matrix
   * @param aspect - the canvas aspect ratio
   */
  injectFrameUniforms(matrix: Float32Array, view: Float32Array, aspect: VectorPoint): void {
    this.updateMatrix = matrix;
    this.updateInputs = view;
    this.updateAspect = aspect;
  }

  /** Flush the uniforms to the GPU */
  flush(): void {
    if (this.updateColorBlindMode !== null) this.setColorBlindMode(this.updateColorBlindMode);
    if (this.updateMatrix !== null) this.setMatrix(this.updateMatrix);
    if (this.updateInputs !== null) this.setInputs(this.updateInputs);
    if (this.updateAspect !== null) this.setAspect(this.updateAspect);
  }

  /**
   * Setup the tile uniforms
   * @param tile - the tile
   * @param parent - the parent tile if applicable
   */
  setTileUniforms(tile: Tile, parent?: Tile): void {
    const { id, type, bottomTop, faceST, matrix } = parent ?? tile;
    if (id === this.curTile) return;
    this.curTile = id;
    this.setTilePos(bottomTop);
    if (type === 'S2') {
      this.setFaceST(faceST);
      // gl.uniform1i(uniforms.uIsS2, 1);
    } else {
      this.setMatrix(matrix);
      // gl.uniform1i(uniforms.uIsS2, 0);
    }
  }

  /**
   * Set the device pixel ratio uniform
   * @param _ratio - the device pixel ratio
   */
  setDevicePixelRatio(_ratio: number): void {
    const { uniforms } = this;
    if (uniforms.uDevicePixelRatio === undefined) return;
    // this.gl.uniform1f(uniforms.uDevicePixelRatio, ratio);
  }

  /**
   * Set the colorblind mode uniform
   * @param _colorMode - the colorblind mode
   */
  setColorBlindMode(_colorMode: ColorMode): void {
    const { uniforms } = this;
    if (uniforms.uCBlind === undefined) return;
    // this.gl.uniform1f(uniforms.uCBlind, colorMode);
    // if (type === 1 && colorMode !== 0) {
    //   // uCVD
    //   if (!('uCVD' in uniforms)) return;
    //   if (colorMode === 1) gl.uniform1fv(uniforms.uCVD, [0, 2.02344, -2.52581, 0, 1, 0, 0, 0, 1]);
    //   else if (colorMode === 2)
    //     gl.uniform1fv(uniforms.uCVD, [1, 0, 0, 0.494207, 0, 1.24827, 0, 0, 1]);
    //   else if (colorMode === 3)
    //     gl.uniform1fv(uniforms.uCVD, [1, 0, 0, 0, 1, 0, -0.395913, 0.801109, 0]);
    // }
    // flush update pointers
    this.updateColorBlindMode = null;
  }

  /**
   * Set the current matrix uniform
   * @param _matrix - the matrix
   */
  setMatrix(_matrix: Float32Array): void {
    const { uniforms } = this;
    if (uniforms.uMatrix === undefined) return;
    // this.gl.uniformMatrix4fv(uniforms.uMatrix, false, matrix);
    // flush update pointers
    this.updateMatrix = null;
  }

  /**
   * Setup basic inputs uniform values
   * @param _inputs - the inputs
   */
  setInputs(_inputs: Float32Array): void {
    const { uniforms } = this;
    if (uniforms.uInputs === undefined) return;
    // this.gl.uniform1fv(uniforms.uInputs, inputs);
    this.updateInputs = null; // ensure updateInputs is "flushed"
  }

  /**
   * Set the canvas aspect uniform values
   * @param _aspect - the aspect
   */
  setAspect(_aspect: VectorPoint): void {
    const { uniforms } = this;
    if (uniforms.uAspect === undefined) return;
    // this.gl.uniform2fv(uniforms.uAspect, [aspect.x, aspect.y]);
    this.updateAspect = null;
  }

  /**
   * Set the faceST uniform values
   * @param _faceST - the faceST
   */
  setFaceST(_faceST: number[]): void {
    const { uniforms } = this;
    if (uniforms.uFaceST === undefined) return;
    // this.gl.uniform1fv(uniforms.uFaceST, faceST);
  }

  /**
   * Set the tile position uniform
   * @param _bottomTop - the tile position
   */
  setTilePos(_bottomTop: Float32Array): void {
    const { uniforms } = this;
    if (uniforms.uBottom === undefined || uniforms.uTop === undefined) return;
    // gl.uniform4fv(uniforms.uBottom, bottomTop.subarray(0, 4));
    // gl.uniform4fv(uniforms.uTop, bottomTop.subarray(4, 8));
  }

  /**
   * Set the layer code uniform data
   * @param layerIndex - the layer index
   * @param layerCode - the encoded layer data
   * @param lch - whether or not the layer is LCH encoded or RGB
   */
  setLayerCode(layerIndex: number, layerCode: number[], lch = false): void {
    const { uniforms } = this;
    if (this.curLayer === layerIndex) return;
    this.curLayer = layerIndex;
    if (uniforms.uLayerCode !== undefined && layerCode.length > 0)
      if (uniforms.uLCH !== undefined && this.LCH !== lch) {
        // gl.uniform1fv(uniforms.uLayerCode, layerCode);
        // also set lch if we need to
        this.LCH = lch;
        // gl.uniform1i(uniforms.uLCH, ~~lch);
      }
  }

  /**
   * Set the interactive mode uniform
   * @param interactive - the interactive mode
   */
  setInteractive(interactive: boolean): void {
    const { uniforms } = this;
    if (uniforms.uInteractive !== undefined && this.interactive !== interactive) {
      this.interactive = interactive;
      // gl.uniform1i(uniforms.uInteractive, ~~interactive);
    }
  }

  /**
   * Set the current feature code
   * @param featureCode - the feature code
   */
  setFeatureCode(featureCode: number[]): void {
    const { uniforms } = this;
    if (uniforms.uFeatureCode !== undefined && featureCode.length !== 0) {
      // gl.uniform1fv(uniforms.uFeatureCode, featureCode);
    }
  }

  /**
   * Set the curent draw mode (uniform used by the shader)
   * @param mode - the draw mode
   */
  setMode(mode: number): void {
    const { uniforms } = this;
    if (uniforms.uMode !== undefined && this.curMode !== mode) {
      // update current value
      this.curMode = mode;
      // update gpu uniform
      // gl.uniform1i(uniforms.uMode, mode);
    }
  }
}
