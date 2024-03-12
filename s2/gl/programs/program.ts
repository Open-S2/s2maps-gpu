import loadShader from './loadShader'

import type { Context } from '../contexts/context.spec'
import type {
  AttributeLocations,
  Attributes,
  ProgramSpec,
  ShaderSource,
  Uniforms
} from './program.spec'
import type { ColorMode } from 's2Map'
import type { TileGL } from 'source/tile.spec'

export default class Program implements ProgramSpec {
  vertexShader!: WebGLShader
  fragmentShader!: WebGLShader
  radii = false
  context: Context
  gl: WebGLRenderingContext | WebGL2RenderingContext
  type: 1 | 2
  glProgram: WebGLProgram
  updateColorBlindMode: null | ColorMode = null
  updateMatrix: null | Float32Array = null // pointer
  updateInputs: null | Float32Array = null // pointer
  updateAspect: null | [number, number] = null // pointer
  curMode = -1
  LCH?: boolean
  interactive?: boolean
  uniforms!: Record<string, WebGLUniformLocation>

  constructor (context: Context) {
    // set context
    this.context = context
    // grab variables we need
    const { gl, type } = context
    this.gl = gl
    this.type = type >= 2 ? 2 : 1
    // create the program
    const program = gl.createProgram()
    if (program === null) throw Error('Failed to create program')
    this.glProgram = program
  }

  buildShaders (vertex: ShaderSource, fragment: ShaderSource, attributeLocations?: AttributeLocations): void {
    const { gl, glProgram } = this
    // setup attribute locations prior to building
    if (attributeLocations !== undefined) this.setupAttributes(vertex.attributes, attributeLocations)
    // load vertex and fragment shaders
    const vertexShader = this.vertexShader = loadShader(gl, vertex.source, gl.VERTEX_SHADER)
    const fragmentShader = this.fragmentShader = loadShader(gl, fragment.source, gl.FRAGMENT_SHADER)
    // if shaders worked, attach, link, validate, etc.
    gl.attachShader(glProgram, vertexShader)
    gl.attachShader(glProgram, fragmentShader)
    gl.linkProgram(glProgram)

    if (gl.getProgramParameter(glProgram, gl.LINK_STATUS) === false) {
      throw Error(gl.getProgramInfoLog(glProgram) ?? 'Failed to link program')
    }

    const uniforms: Uniforms = { ...vertex.uniforms, ...fragment.uniforms }

    this.setupUniforms(uniforms)
  }

  setupUniforms (uniforms: Uniforms): void {
    const { gl, glProgram } = this
    this.uniforms = {}

    for (const [uniform, code] of Object.entries(uniforms)) {
      // const uniformName = uniform as keyof this
      const location = gl.getUniformLocation(glProgram, code)
      if (location === null) {
        console.error(`failed to get uniform location for ${uniform}`)
        continue
      }
      this.uniforms[uniform] = location
    }
  }

  setupAttributes (attributes: Attributes, attributeLocations: AttributeLocations): void {
    const { gl, glProgram } = this
    for (const attr in attributeLocations) {
      gl.bindAttribLocation(glProgram, attributeLocations[attr], attributes[attr])
    }
  }

  delete (): void {
    const { gl, vertexShader, fragmentShader } = this
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
  }

  use (): void {
    const { gl, glProgram } = this

    gl.useProgram(glProgram)
    this.flush()
  }

  injectFrameUniforms (matrix: Float32Array, view: Float32Array, aspect: [number, number]): void {
    this.updateMatrix = matrix
    this.updateInputs = view
    this.updateAspect = aspect
  }

  flush (): void {
    if (this.updateColorBlindMode !== null) this.setColorBlindMode(this.updateColorBlindMode)
    if (this.updateMatrix !== null) this.setMatrix(this.updateMatrix)
    if (this.updateInputs !== null) this.setInputs(this.updateInputs)
    if (this.updateAspect !== null) this.setAspect(this.updateAspect)
  }

  setTileUniforms (tile: TileGL): void {
    const { gl, uniforms } = this
    const { type, bottomTop } = tile
    this.setTilePos(bottomTop)
    if (type === 'S2') {
      const { faceST } = tile
      this.setFaceST(faceST)
      gl.uniform1i(uniforms.uIsS2, 1)
    } else {
      const { matrix } = tile
      this.setMatrix(matrix)
      gl.uniform1i(uniforms.uIsS2, 0)
    }
  }

  setDevicePixelRatio (ratio: number): void {
    const { uniforms } = this
    if (uniforms.uDevicePixelRatio === undefined) return
    this.gl.uniform1f(uniforms.uDevicePixelRatio, ratio)
  }

  setColorBlindMode (colorMode: ColorMode): void {
    const { gl, type, uniforms } = this
    if (uniforms.uCBlind === undefined) return
    this.gl.uniform1f(uniforms.uCBlind, colorMode)
    if (type === 1 && colorMode !== 0) {
      // uCVD
      if (!('uCVD' in uniforms)) return
      if (colorMode === 1) gl.uniform1fv(uniforms.uCVD, [0, 2.02344, -2.52581, 0, 1, 0, 0, 0, 1])
      else if (colorMode === 2) gl.uniform1fv(uniforms.uCVD, [1, 0, 0, 0.494207, 0, 1.24827, 0, 0, 1])
      else if (colorMode === 3) gl.uniform1fv(uniforms.uCVD, [1, 0, 0, 0, 1, 0, -0.395913, 0.801109, 0])
    }
    // flush update pointers
    this.updateColorBlindMode = null
  }

  setMatrix (matrix: Float32Array): void {
    const { uniforms } = this
    if (uniforms.uMatrix === undefined) return
    this.gl.uniformMatrix4fv(uniforms.uMatrix, false, matrix)
    // flush update pointers
    this.updateMatrix = null
  }

  setInputs (inputs: Float32Array): void {
    const { uniforms } = this
    if (uniforms.uInputs === undefined) return
    this.gl.uniform1fv(uniforms.uInputs, inputs)
    this.updateInputs = null // ensure updateInputs is "flushed"
  }

  setAspect (aspect: [number, number]): void {
    const { uniforms } = this
    if (uniforms.uAspect === undefined) return
    this.gl.uniform2fv(uniforms.uAspect, aspect)
    this.updateAspect = null
  }

  setFaceST (faceST: number[]): void {
    const { uniforms } = this
    if (uniforms.uFaceST === undefined) return
    this.gl.uniform1fv(uniforms.uFaceST, faceST)
  }

  setTilePos (bottomTop: Float32Array): void {
    const { uniforms, gl } = this
    if (uniforms.uBottom === undefined || uniforms.uTop === undefined) return
    gl.uniform4fv(uniforms.uBottom, bottomTop.subarray(0, 4))
    gl.uniform4fv(uniforms.uTop, bottomTop.subarray(4, 8))
  }

  setLayerCode (layerCode: number[], lch = false): void {
    const { uniforms, gl } = this
    if (uniforms.uLayerCode !== undefined && layerCode.length > 0) gl.uniform1fv(uniforms.uLayerCode, layerCode)
    // also set lch if we need to
    if (uniforms.uLCH !== undefined && this.LCH !== lch) {
      this.LCH = lch
      gl.uniform1i(uniforms.uLCH, ~~lch)
    }
  }

  setInteractive (interactive: boolean): void {
    const { uniforms, gl } = this
    if (uniforms.uInteractive !== undefined && this.interactive !== interactive) {
      this.interactive = interactive
      gl.uniform1i(uniforms.uInteractive, ~~interactive)
    }
  }

  setFeatureCode (featureCode: number[]): void {
    const { uniforms, gl } = this
    if (uniforms.uFeatureCode !== undefined && featureCode.length !== 0) {
      gl.uniform1fv(uniforms.uFeatureCode, featureCode)
    }
  }

  setMode (mode: number): void {
    const { uniforms, gl } = this
    if (uniforms.uMode !== undefined && this.curMode !== mode) {
      // update current value
      this.curMode = mode
      // update gpu uniform
      gl.uniform1i(uniforms.uMode, mode)
    }
  }
}
