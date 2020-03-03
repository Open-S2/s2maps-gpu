// @flow
import Painter from '../painter'
import { WallpaperProgram } from '../programs'
import { Wallpaper } from '../../source'

import type { WallpaperUniforms } from '../../source/wallpaper'

export default function drawWallpaper (painter: Painter, wallpaper: Wallpaper) {
  // setup variables
  const { context } = painter
  const { gl } = context
  const { skybox } = wallpaper
  const wallpaperProgram: WallpaperProgram = painter.getProgram(skybox ? 'skybox' : 'wallpaper')
  if (!wallpaperProgram) return
  // now we draw
  gl.useProgram(wallpaperProgram.glProgram)
  // bind the vao
  context.bindVertexArray(wallpaperProgram.vao)
  // ensure we are using equal depth test like rasters
  context.lequalDepth()
  // depending upon type, setup variables and draw
  if (skybox) {
    if (wallpaperProgram.renderable) {
      // set matrix if necessary
      const matrix = wallpaper.getMatrix()
      if (matrix) gl.uniformMatrix4fv(wallpaperProgram.uMatrix, false, matrix)
      // set box texture
      gl.uniform1i(wallpaperProgram.uSkybox, 0)
      // Draw the geometry.
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
  } else {
    // set new uniforms should we need to
    const uniforms: null | WallpaperUniforms = wallpaper.getUniforms()
    if (uniforms) {
      gl.uniform2fv(wallpaperProgram.uScale, uniforms.uScale)
      gl.uniform4fv(wallpaperProgram.uBackgroundColor, uniforms.uBackgroundColor)
      gl.uniform4fv(wallpaperProgram.uFade1Color, uniforms.uFade1Color)
      gl.uniform4fv(wallpaperProgram.uFade2Color, uniforms.uFade2Color)
      gl.uniform4fv(wallpaperProgram.uHaloColor, uniforms.uHaloColor)
    }
    wallpaper.dirty = false
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
  }
}
