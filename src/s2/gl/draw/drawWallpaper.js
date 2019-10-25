// @flow
import Painter from '../painter'
import { WallpaperProgram } from '../programs'
import { Wallpaper } from '../../source'

import type { WallpaperUniforms } from '../../source/wallpaper'

export default function drawWallpaper (painter: Painter, wallpaper: Wallpaper) {
  // setup variables
  const { gl } = painter.context
  const wallpaperProgram: WallpaperProgram = painter.getProgram('wallpaper')
  if (!wallpaperProgram) return
  // now we draw
  gl.useProgram(wallpaperProgram.glProgram)
  const uniforms: null | WallpaperUniforms = wallpaper.getUniforms()
  if (uniforms) {
    gl.uniform2fv(wallpaperProgram.uScale, uniforms.uScale)
    gl.uniform3fv(wallpaperProgram.backgroundColor, uniforms.backgroundColor)
    gl.uniform3fv(wallpaperProgram.fade1Color, uniforms.fade1Color)
    gl.uniform3fv(wallpaperProgram.fade2Color, uniforms.fade2Color)
    gl.uniform3fv(wallpaperProgram.haloColor, uniforms.haloColor)
  }
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
}
