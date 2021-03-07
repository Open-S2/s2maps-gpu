// @flow
/* global WebGLRenderingContext WebGLProgram WebGLUniformLocation */
import loadShader from './loadShader'

import type { Context } from '../contexts'
import type { FeatureGuide } from '../../source/tile'
export type ProgramType = 'mask' | 'fill' | 'line' | 'raster' | 'shade' | 'glyph' | 'glyphFill' | 'glyphFilter' | 'wallpaper' | 'skybox' | 'fill3D' | 'line3D'

type uniformSource = { variableName: string, variableType: string }
type shaderSource = { sourceCode: string, uniforms: { [string]: uniformSource } }

export default class Program {
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  radii: boolean = false
  context: Context
  gl: WebGLRenderingContext
  glProgram: WebGLProgram
  uMatrix: WebGLUniformLocation
  uAspect: WebGLUniformLocation
  uMode: WebGLUniformLocation
  u3D: WebGLUniformLocation
  uLCH: WebGLUniformLocation
  uInteractive: WebGLUniformLocation
  uFaceST: WebGLUniformLocation
  uBottom: WebGLUniformLocation
  uTop: WebGLUniformLocation
  uInputs: WebGLUniformLocation
  uLayerCode: WebGLUniformLocation
  uFeatureCode: WebGLUniformLocation
  uDevicePixelRatio: WebGLUniformLocation
  updateMatrix: null | Float32Array = null // pointer
  updateInputs: null | Float32Array = null // pointer
  updateAspect: null | Float32Array = null // pointer
  curMode: number = -1
  threeD: boolean
  LCH: boolean
  interactive: boolean
  constructor (context: Context) {
    // set context
    this.context = context
    // grab variables we need
    const { gl } = context
    this.gl = gl
    // create the program
    const program = this.glProgram = gl.createProgram()
    // setup attribute location data if necessary
    const attrLoc = gl.attributeLocations
    if (attrLoc) for (const attr in attrLoc) gl.bindAttribLocation(program, attrLoc[attr], attr)
  }

  async buildShaders (vertex: shaderSource, fragment: shaderSource) {
    const { gl, glProgram } = this
    const vertexShaderSource = vertex.sourceCode
    const vertexUniforms = vertex.uniforms
    const fragmentShaderSource = fragment.sourceCode
    const fragmentUniforms = fragment.uniforms
    // load vertex and fragment shaders
    const vertexShader = this.vertexShader = loadShader(gl, vertexShaderSource, gl.VERTEX_SHADER)
    const fragmentShader = this.fragmentShader = loadShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER)
    // if shaders worked, attach, link, validate, etc.
    if (vertexShader && fragmentShader) {
      gl.attachShader(glProgram, vertexShader)
      gl.attachShader(glProgram, fragmentShader)
      gl.linkProgram(glProgram)

      if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
        throw Error(gl.getProgramInfoLog(glProgram))
      }

      this.setupUniforms({ ...vertexUniforms, ...fragmentUniforms })
    } else { throw Error('missing shaders') }
  }

  setupUniforms (uniforms) {
    const { gl, glProgram } = this

    for (const uniform in uniforms) this[uniform] = gl.getUniformLocation(glProgram, uniforms[uniform].variableName)
  }

  delete () {
    const { gl, vertexShader, fragmentShader } = this
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
  }

  use () {
    this.gl.useProgram(this.glProgram)
    this.flush()
  }

  injectFrameUniforms (matrix: Float32Array, view: Float32Array, aspect: Float32Array) {
    this.updateMatrix = matrix
    this.updateInputs = view
    this.updateAspect = aspect
  }

  flush () {
    if (this.updateMatrix) this.setMatrix(this.updateMatrix)
    if (this.updateInputs) this.setInputs(this.updateInputs)
    if (this.updateAspect) this.setAspect(this.updateAspect)
  }

  setDevicePixelRatio (ratio: number) {
    this.gl.uniform1f(this.uDevicePixelRatio, ratio)
  }

  setMatrix (matrix: Float32Array) {
    this.gl.uniformMatrix4fv(this.uMatrix, false, matrix)
    // flush update pointers
    this.updateMatrix = null
  }

  setInputs (inputs: Float32Array) {
    this.gl.uniform1fv(this.uInputs, inputs, 0, inputs.length)
    this.updateInputs = null // ensure updateInputs is "flushed"
  }

  setAspect (aspect: Float32Array) {
    this.gl.uniform2fv(this.uAspect, aspect)
    this.updateAspect = null
  }

  setFaceST (faceST: Float32Array) {
    this.gl.uniform1fv(this.uFaceST, faceST, 0, faceST.length)
  }

  setTilePos (bottom: Float32Array, top: Float32Array) {
    if (bottom) this.gl.uniform4fv(this.uBottom, bottom, 0, 4)
    if (top) this.gl.uniform4fv(this.uTop, top, 0, 4)
  }

  setLayerCode (layerCode: Float32Array, lch?: boolean = false) {
    const { gl } = this
    if (layerCode.length) gl.uniform1fv(this.uLayerCode, layerCode, 0, layerCode.length)
    // also set lch if we need to
    if (this.uLCH && this.LCH !== lch) {
      this.LCH = lch
      gl.uniform1i(this.uLCH, ~~lch)
    }
  }

  setInteractive (interactive: boolean) {
    const { gl } = this
    if (this.interactive !== interactive) {
      this.interactive = interactive
      gl.uniform1i(this.uInteractive, interactive)
    }
  }

  setFeatureCode (featureCode?: Float32Array) {
    if (featureCode && featureCode.length) this.gl.uniform1fv(this.uFeatureCode, featureCode)
  }

  set3D (state?: boolean = false) {
    if (this.u3D && this.threeD !== state) {
      this.threeD = state
      this.gl.uniform1i(this.u3D, state)
    }
  }

  setMode (mode: number) {
    if (this.uMode && this.curMode !== mode) {
      // update current value
      this.curMode = mode
      // update gpu uniform
      this.gl.uniform1i(this.uMode, mode)
    }
  }

  draw (featureGuide: FeatureGuide) {}
}
