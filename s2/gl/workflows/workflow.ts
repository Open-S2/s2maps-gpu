import { ColorMode } from 's2/s2Map.js';
import loadShader from './loadShader.js';

import type Context from '../context/context.js';
import type { TileGL as Tile } from 'source/tile.spec.js';
import type {
  AttributeLocations,
  Attributes,
  FeatureBase,
  LayerGuides,
  ShaderSource,
  Uniforms,
  Workflow as WorkflowFeature,
  WorkflowSpec,
} from './workflow.spec.js';
import type { BBox, VectorPoint } from 'gis-tools/index.js';

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

  /** Destroy the feature */
  destroy(): void {}
}

/** Generic Workflow used by most workflows */
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
   * @param context - the context to use that tracks the GPU state
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
   * @param vertex - the vertex shader
   * @param fragment - the fragment shader
   * @param attributeLocations - the attribute locations
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
   * Setup the connections to uniforms in the shader
   * @param uniforms - the mapping of uniform names to shader names
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
   * Setup shader attributes, their names and locations
   * @param attributes - the mapping of attribute names to shader names
   * @param attributeLocations - the mapping of attribute names to locations
   */
  setupAttributes(attributes: Attributes, attributeLocations: AttributeLocations): void {
    const { gl, glProgram } = this;
    for (const attr in attributeLocations) {
      gl.bindAttribLocation(glProgram, attributeLocations[attr], attributes[attr]);
    }
  }

  /** Delete the workflow and it's shaders */
  delete(): void {
    const { gl, vertexShader, fragmentShader } = this;
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  }

  /** Activate this workflow as the current shaders for the GPU */
  use(): void {
    const { gl, glProgram } = this;
    // reset tile tracker since it impacts wether we update our matrix or not
    this.curTile = -1n;

    gl.useProgram(glProgram);
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
   * Set the device pixel ratio uniform
   * @param ratio - the device pixel ratio
   */
  setDevicePixelRatio(ratio: number): void {
    const { uniforms } = this;
    if (uniforms.uDevicePixelRatio === undefined) return;
    this.gl.uniform1f(uniforms.uDevicePixelRatio, ratio);
  }

  /**
   * Set the colorblind mode uniform
   * @param colorMode - the colorblind mode
   */
  setColorBlindMode(colorMode: ColorMode): void {
    const { gl, type, uniforms } = this;
    if (uniforms.uCBlind === undefined) return;
    this.gl.uniform1f(uniforms.uCBlind, colorMode);
    if (type === ColorMode.Protanopia && colorMode !== ColorMode.None) {
      // uCVD
      if (!('uCVD' in uniforms)) return;
      if (colorMode === ColorMode.Protanopia)
        gl.uniform1fv(uniforms.uCVD, [0, 2.02344, -2.52581, 0, 1, 0, 0, 0, 1]);
      else if (colorMode === ColorMode.Deuteranopia)
        gl.uniform1fv(uniforms.uCVD, [1, 0, 0, 0.494207, 0, 1.24827, 0, 0, 1]);
      else if (colorMode === ColorMode.Tritanopia)
        gl.uniform1fv(uniforms.uCVD, [1, 0, 0, 0, 1, 0, -0.395913, 0.801109, 0]);
    }
    // flush update pointers
    this.updateColorBlindMode = null;
  }

  /**
   * Set the current matrix uniform
   * @param matrix - the matrix
   */
  setMatrix(matrix: Float32Array): void {
    const { uniforms } = this;
    if (uniforms.uMatrix === undefined) return;
    this.gl.uniformMatrix4fv(uniforms.uMatrix, false, matrix);
    // flush update pointers
    this.updateMatrix = null;
  }

  /**
   * Setup basic inputs uniform values
   * @param inputs - the inputs
   */
  setInputs(inputs: Float32Array): void {
    const { uniforms } = this;
    if (uniforms.uInputs === undefined) return;
    this.gl.uniform1fv(uniforms.uInputs, inputs);
    this.updateInputs = null; // ensure updateInputs is "flushed"
  }

  /**
   * Set the canvas aspect uniform values
   * @param aspect - the aspect
   */
  setAspect(aspect: VectorPoint): void {
    const { uniforms } = this;
    if (uniforms.uAspect === undefined) return;
    this.gl.uniform2fv(uniforms.uAspect, [aspect.x, aspect.y]);
    this.updateAspect = null;
  }

  /**
   * Set the faceST uniform values
   * @param faceST - the faceST
   */
  setFaceST(faceST: number[]): void {
    const { uniforms } = this;
    if (uniforms.uFaceST === undefined) return;
    this.gl.uniform1fv(uniforms.uFaceST, faceST);
  }

  /**
   * Set the tile position uniform
   * @param bottomTop - the tile position
   */
  setTilePos(bottomTop: Float32Array): void {
    const { uniforms, gl } = this;
    if (uniforms.uBottom === undefined || uniforms.uTop === undefined) return;
    gl.uniform4fv(uniforms.uBottom, bottomTop.subarray(0, 4));
    gl.uniform4fv(uniforms.uTop, bottomTop.subarray(4, 8));
  }

  /**
   * Set the layer code uniform data
   * @param layerIndex - the layer index
   * @param layerCode - the encoded layer data
   * @param lch - whether or not the layer is LCH encoded or RGB
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
   * Set the interactive mode uniform
   * @param interactive - the interactive mode
   */
  setInteractive(interactive: boolean): void {
    const { uniforms, gl } = this;
    if (uniforms.uInteractive !== undefined && this.interactive !== interactive) {
      this.interactive = interactive;
      gl.uniform1i(uniforms.uInteractive, ~~interactive);
    }
  }

  /**
   * Set the current feature code
   * @param featureCode - the feature code
   */
  setFeatureCode(featureCode: number[]): void {
    const { uniforms, gl } = this;
    if (uniforms.uFeatureCode !== undefined && featureCode.length !== 0) {
      gl.uniform1fv(uniforms.uFeatureCode, featureCode);
    }
  }

  /**
   * Set the curent draw mode (uniform used by the shader)
   * @param mode - the draw mode
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
