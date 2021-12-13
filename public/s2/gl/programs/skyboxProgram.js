// @flow
/* eslint-env browser */
/* global GLint */
import Program from './program'
import Map from '../../ui/map'

// WEBGL1
import vert1 from '../shaders/skybox1.vertex.glsl'
import frag1 from '../shaders/skybox1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/skybox2.vertex.glsl'
import frag2 from '../shaders/skybox2.fragment.glsl'

import type { Context } from '../contexts'
import type { Wallpaper, Skybox } from '../../source/wallpaper'

export default class SkyboxProgram extends Program {
  aPos: GLint // 'a_pos' vec4 attribute
  cubeMap: WebGLTexture
  facesReady: number = 0
  renderable: boolean = false
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // install shaders
    super(context)
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1)
    else this.buildShaders(vert2, frag2)
    // prep a cube texture
    this.cubeMap = gl.createTexture()
  }

  injectImages (skybox: Skybox, map: Map) {
    const self = this
    const { gl } = self
    const { path, type, size } = skybox
    // request each face and assign to cube map
    for (let i = 0; i < 6; i++) {
      fetch(`${path}/${size}/${i}.${type}`)
        .then(res => {
          if (res.status !== 200 && res.status !== 206) return null
          return res.blob()
        })
        .then(data => {
          if (data) {
            createImageBitmap(data)
              .then(image => {
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, self.cubeMap)
                gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
                // ensure size X size is a power of 2 (only way to generate mips)
                self.facesReady++
                if (self.facesReady === 6) {
                  gl.generateMipmap(gl.TEXTURE_CUBE_MAP)
                  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
                  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
                  this.renderable = true
                  // set the projector as dirty to ensure a proper initial render
                  map.projector.reset()
                  // call the full re-render
                  map.render()
                }
              })
          }
        })
    }
  }

  draw (wallpaper: Wallpaper) {
    // setup variables
    const { gl, context } = this
    // if renderable, time to draw
    if (this.renderable) {
      // ignore z-fighting and only pass where stencil is 0
      context.wallpaperState()
      // set matrix if necessary
      const matrix = wallpaper.getMatrix()
      gl.uniformMatrix4fv(this.uMatrix, false, matrix)
      // Draw the geometry.
      context.drawQuad()
    }
  }
}
