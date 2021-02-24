// @flow
/* global createImageBitmap GLint WebGLTexture */
import Program from './program'
import Map from '../../ui/map'
import requestData from '../../util/fetch'

// WEBGL1
import vert1 from '../../shaders/skybox1.vertex.glsl'
import frag1 from '../../shaders/skybox1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/skybox2.vertex.glsl'
import frag2 from '../../shaders/skybox2.fragment.glsl'

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
    const self = this

    return Promise.all([
      (type === 1) ? vert1 : vert2,
      (type === 1) ? frag1 : frag2
    ])
      .then(([vertex, fragment]) => {
        // build shaders
        self.buildShaders(vertex, fragment)
        // prep a cube texture
        self.cubeMap = gl.createTexture()

        return self
      })
  }

  injectImages (skybox: Skybox, map: Map) {
    const self = this
    const { gl } = self
    const { path, type, size } = skybox
    // request each face and assign to cube map
    for (let i = 0; i < 6; i++) {
      requestData(`${path}/${size}/${i}`, type, (data) => {
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
                // set the projection as dirty to ensure a proper initial render
                map.projection.dirty = true
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
    const { context } = this
    const { gl } = context
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
