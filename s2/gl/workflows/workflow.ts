import loadShader from './loadShader';

import type { ColorMode } from 's2Map';
import type Context from '../context/context';
import type { TileGL as Tile } from 'source/tile.spec';
import type {
  AttributeLocations,
  Attributes,
  FeatureBase,
  LayerGuides,
  ShaderSource,
  Uniforms,
  Workflow as WorkflowFeature,
  WorkflowSpec,
} from './workflow.spec';
import type { BBox, VectorPoint } from 'gis-tools';

/**
 *
 */
export class Feature implements FeatureBase {
  /**
   * @param workflow
   * @param tile
   * @param layerGuide
   * @param featureCode
   * @param parent
   * @param bounds
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
   * @param interactive
   */
  draw(interactive = false): void {
    const { tile, parent, workflow, layerGuide } = this;
    const { context } = workflow;
    const { layerIndex, layerCode, lch } = layerGuide;
    // let the context know the current workflow
    workflow.context.setWorkflow(workflow);
    // ensure the tile information is set
    workflow.setTileUniforms(tile, parent);
    // setup stencil
    context.stencilFuncEqual(tile.tmpMaskID);
    // set layer code
    workflow.setLayerCode(layerIndex, layerCode, lch);
    // set interactive if applicable
    workflow.setInteractive(interactive);
  }

  /**
   *
   */
  destroy(): void {}
}

/**
 *
 */
export default class Workflow implements WorkflowSpec {
  vertexShader!: WebGLShader;
  fragmentShader!: WebGLShader;
  radii = false;
  context: Context;
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  type: 1 | 2;
  glProgram: WebGLProgram;
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
   * @param context
   */
  constructor(context: Context) {
    // set context
    this.context = context;
    // grab variables we need
    const { gl, type } = context;
    this.gl = gl;
    this.type = type >= 2 ? 2 : 1;
    // create the program
    const program = gl.createProgram();
    if (program === null) throw Error('Failed to create program');
    this.glProgram = program;
  }

  /**
   * @param vertex
   * @param fragment
   * @param attributeLocations
   */
  buildShaders(
    vertex: ShaderSource,
    fragment: ShaderSource,
    attributeLocations?: AttributeLocations,
  ): void {
    const { gl, glProgram } = this;
    // setup attribute locations prior to building
    if (attributeLocations !== undefined)
      this.setupAttributes(vertex.attributes, attributeLocations);
    // load vertex and fragment shaders
    const vertexShader = (this.vertexShader = loadShader(gl, vertex.source, gl.VERTEX_SHADER));
    const fragmentShader = (this.fragmentShader = loadShader(
      gl,
      fragment.source,
      gl.FRAGMENT_SHADER,
    ));
    // if shaders worked, attach, link, validate, etc.
    gl.attachShader(glProgram, vertexShader);
    gl.attachShader(glProgram, fragmentShader);
    gl.linkProgram(glProgram);

    if (gl.getProgramParameter(glProgram, gl.LINK_STATUS) === false) {
      throw Error(gl.getProgramInfoLog(glProgram) ?? 'Failed to link program');
    }

    const uniforms: Uniforms = { ...vertex.uniforms, ...fragment.uniforms };

    this.setupUniforms(uniforms);
  }

  /**
   * @param uniforms
   */
  setupUniforms(uniforms: Uniforms): void {
    const { gl, glProgram } = this;
    this.uniforms = {};

    for (const [uniform, code] of Object.entries(uniforms)) {
      // const uniformName = uniform as keyof this
      const location = gl.getUniformLocation(glProgram, code);
      if (location === null) {
        console.error(`failed to get uniform location for ${uniform}`);
        continue;
      }
      this.uniforms[uniform] = location;
    }
  }

  /**
   * @param attributes
   * @param attributeLocations
   */
  setupAttributes(attributes: Attributes, attributeLocations: AttributeLocations): void {
    const { gl, glProgram } = this;
    for (const attr in attributeLocations) {
      gl.bindAttribLocation(glProgram, attributeLocations[attr], attributes[attr]);
    }
  }

  /**
   *
   */
  delete(): void {
    const { gl, vertexShader, fragmentShader } = this;
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  }

  /**
   *
   */
  use(): void {
    const { gl, glProgram } = this;
    // reset tile tracker since it impacts wether we update our matrix or not
    this.curTile = -1n;

    gl.useProgram(glProgram);
    this.flush();
  }

  /**
   * @param matrix
   * @param view
   * @param aspect
   */
  injectFrameUniforms(matrix: Float32Array, view: Float32Array, aspect: VectorPoint): void {
    this.updateMatrix = matrix;
    this.updateInputs = view;
    this.updateAspect = aspect;
  }

  /**
   *
   */
  flush(): void {
    if (this.updateColorBlindMode !== null) this.setColorBlindMode(this.updateColorBlindMode);
    if (this.updateMatrix !== null) this.setMatrix(this.updateMatrix);
    if (this.updateInputs !== null) this.setInputs(this.updateInputs);
    if (this.updateAspect !== null) this.setAspect(this.updateAspect);
  }

  /**
   * @param tile
   * @param parent
   */
  setTileUniforms(tile: Tile, parent?: Tile): void {
    const { gl, uniforms } = this;
    const { id, type, bottomTop, faceST, matrix } = parent ?? tile;
    if (id === this.curTile) return;
    this.curTile = id;
    this.setTilePos(bottomTop);
    if (type === 'S2') {
      this.setFaceST(faceST);
      gl.uniform1i(uniforms.uIsS2, 1);
    } else {
      this.setMatrix(matrix);
      gl.uniform1i(uniforms.uIsS2, 0);
    }
  }

  /**
   * @param ratio
   */
  setDevicePixelRatio(ratio: number): void {
    const { uniforms } = this;
    if (uniforms.uDevicePixelRatio === undefined) return;
    this.gl.uniform1f(uniforms.uDevicePixelRatio, ratio);
  }

  /**
   * @param colorMode
   */
  setColorBlindMode(colorMode: ColorMode): void {
    const { gl, type, uniforms } = this;
    if (uniforms.uCBlind === undefined) return;
    this.gl.uniform1f(uniforms.uCBlind, colorMode);
    if (type === 1 && colorMode !== 0) {
      // uCVD
      if (!('uCVD' in uniforms)) return;
      if (colorMode === 1) gl.uniform1fv(uniforms.uCVD, [0, 2.02344, -2.52581, 0, 1, 0, 0, 0, 1]);
      else if (colorMode === 2)
        gl.uniform1fv(uniforms.uCVD, [1, 0, 0, 0.494207, 0, 1.24827, 0, 0, 1]);
      else if (colorMode === 3)
        gl.uniform1fv(uniforms.uCVD, [1, 0, 0, 0, 1, 0, -0.395913, 0.801109, 0]);
    }
    // flush update pointers
    this.updateColorBlindMode = null;
  }

  /**
   * @param matrix
   */
  setMatrix(matrix: Float32Array): void {
    const { uniforms } = this;
    if (uniforms.uMatrix === undefined) return;
    this.gl.uniformMatrix4fv(uniforms.uMatrix, false, matrix);
    // flush update pointers
    this.updateMatrix = null;
  }

  /**
   * @param inputs
   */
  setInputs(inputs: Float32Array): void {
    const { uniforms } = this;
    if (uniforms.uInputs === undefined) return;
    this.gl.uniform1fv(uniforms.uInputs, inputs);
    this.updateInputs = null; // ensure updateInputs is "flushed"
  }

  /**
   * @param aspect
   */
  setAspect(aspect: VectorPoint): void {
    const { uniforms } = this;
    if (uniforms.uAspect === undefined) return;
    this.gl.uniform2fv(uniforms.uAspect, [aspect.x, aspect.y]);
    this.updateAspect = null;
  }

  /**
   * @param faceST
   */
  setFaceST(faceST: number[]): void {
    const { uniforms } = this;
    if (uniforms.uFaceST === undefined) return;
    this.gl.uniform1fv(uniforms.uFaceST, faceST);
  }

  /**
   * @param bottomTop
   */
  setTilePos(bottomTop: Float32Array): void {
    const { uniforms, gl } = this;
    if (uniforms.uBottom === undefined || uniforms.uTop === undefined) return;
    gl.uniform4fv(uniforms.uBottom, bottomTop.subarray(0, 4));
    gl.uniform4fv(uniforms.uTop, bottomTop.subarray(4, 8));
  }

  /**
   * @param layerIndex
   * @param layerCode
   * @param lch
   */
  setLayerCode(layerIndex: number, layerCode: number[], lch = false): void {
    const { uniforms, gl } = this;
    if (this.curLayer === layerIndex) return;
    this.curLayer = layerIndex;
    if (uniforms.uLayerCode !== undefined && layerCode.length > 0)
      gl.uniform1fv(uniforms.uLayerCode, layerCode);
    // also set lch if we need to
    if (uniforms.uLCH !== undefined && this.LCH !== lch) {
      this.LCH = lch;
      gl.uniform1i(uniforms.uLCH, ~~lch);
    }
  }

  /**
   * @param interactive
   */
  setInteractive(interactive: boolean): void {
    const { uniforms, gl } = this;
    if (uniforms.uInteractive !== undefined && this.interactive !== interactive) {
      this.interactive = interactive;
      gl.uniform1i(uniforms.uInteractive, ~~interactive);
    }
  }

  /**
   * @param featureCode
   */
  setFeatureCode(featureCode: number[]): void {
    const { uniforms, gl } = this;
    if (uniforms.uFeatureCode !== undefined && featureCode.length !== 0) {
      gl.uniform1fv(uniforms.uFeatureCode, featureCode);
    }
  }

  /**
   * @param mode
   */
  setMode(mode: number): void {
    const { uniforms, gl } = this;
    if (uniforms.uMode !== undefined && this.curMode !== mode) {
      // update current value
      this.curMode = mode;
      // update gpu uniform
      gl.uniform1i(uniforms.uMode, mode);
    }
  }
}
