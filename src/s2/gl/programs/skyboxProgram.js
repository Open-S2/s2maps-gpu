// @flow
import Program from './program'
import Map from '../../ui/map'

import type { Context } from '../contexts'

export default class SkyboxProgram extends Program {
  vao: VertexArrayObject
  vertexBuffer: WebGLVertexArrayObject
  aPos: GLint // 'a_pos' vec4 attribute
  uSkybox: WebGLUniformLocation // 'u_scale' vec2 uniform
  cubeMap: WebGLTexture
  facesReady: number = 0
  renderable: boolean = false
  constructor (context: Context, vertexShaderSource: string, fragmentShaderSource: string) {
    // get gl from context
    const { gl, type } = context
    // upgrade
    super(gl, require(`../../shaders/skybox${type}.vertex.glsl`), require(`../../shaders/skybox${type}.fragment.glsl`), false)
    // acquire the attributes & uniforms
    this.aPos = gl.getAttribLocation(this.glProgram, 'aPos')
    this.uMatrix = gl.getUniformLocation(this.glProgram, 'uMatrix')
    this.uSkybox = gl.getUniformLocation(this.glProgram, 'uSkybox')
    // create a vertex array object
    this.vao = gl.createVertexArray()
    // bind the vao so we can work on it
    gl.bindVertexArray(this.vao)
    // Create a vertex buffer
    this.vertexBuffer = gl.createBuffer()
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = vertexBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1,  1, -1,  1, 1,  -1, 1]), gl.STATIC_DRAW)
    // Turn on the attribute
    gl.enableVertexAttribArray(this.aPos)
    // tell attribute how to get data out of vertexBuffer
    // (attribute pointer, compenents per iteration (size), data size (type), normalize, stride, offset)
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0)
    // prep a cube texture
    this.cubeMap = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubeMap)
    gl.bindVertexArray(null)
  }

  injectImages (skybox: Skybox, map: Map) {
    const self = this
    const { gl } = self
    const { path, type, size } = skybox
    // request each face and assign to cube map
    for (let i = 0; i < 6; i++) {
      // request image
      const image = new Image()
      image.crossOrigin = path
      image.src = `${path}/${size}/${i}.${type}`
      const render = () => {
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, self.cubeMap)
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
        // ensure size X size is a power of 2 (only way to generate mips)
        self.facesReady++
        if (self.facesReady === 6) {
          gl.generateMipmap(gl.TEXTURE_CUBE_MAP)
          gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          this.renderable = true
          // set the projection as dirty to ensure a proper initial render
          map.projection.dirty = true
          // call the full re-render
          map._render()
        }
      }
      if (image.decode) image.decode().then(render).catch(e => { console.log(e) })
      else image.onload = render
    }
  }

  draw (painter: Painter, wallpaper: Wallpaper) {
    // setup variables
    const { context } = painter
    const { gl } = context
    // now we draw
    gl.useProgram(this.glProgram)
    // bind the vao
    gl.bindVertexArray(this.vao)
    // ensure we are using equal depth test like rasters
    context.lequalDepth()
    // if renderable, time to draw
    if (this.renderable) {
      // set matrix if necessary
      const matrix = wallpaper.getMatrix()
      if (matrix) gl.uniformMatrix4fv(this.uMatrix, false, matrix)
      // set box texture
      gl.uniform1i(this.uSkybox, 0)
      // Draw the geometry.
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    }
  }
}
