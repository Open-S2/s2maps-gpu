import Color from 'style/color'
import { degToRad } from 'geometry/util'
import { invert, multiply, perspective, rotate } from 'ui/camera/projector/mat4'
import adjustURL from 'util/adjustURL'

// WEBGL1
import vert1 from '../shaders/skybox1.vertex.glsl'
import frag1 from '../shaders/skybox1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/skybox2.vertex.glsl'
import frag2 from '../shaders/skybox2.fragment.glsl'

import type { Context } from '../contexts/context.spec'
import type { StyleDefinition } from 'style/style.spec'
import type { SkyboxProgram as SkyboxProgramSpec, SkyboxProgramUniforms } from './program.spec'
import type Camera from 'ui/camera'
import type Projector from 'ui/camera/projector'

export default async function skyboxProgram (context: Context): Promise<SkyboxProgramSpec> {
  const Program = await import('./program').then(m => m.default)

  class SkyboxProgram extends Program implements SkyboxProgramSpec {
    cubeMap: WebGLTexture
    facesReady = 0
    renderable = false
    fov: number = degToRad(80)
    angle: number = degToRad(40)
    matrix: Float32Array = new Float32Array(16)
    declare uniforms: { [key in SkyboxProgramUniforms]: WebGLUniformLocation }
    constructor (context: Context) {
      // get gl from context
      const { gl, type } = context
      // install shaders
      super(context)
      // build shaders
      if (type === 1) this.buildShaders(vert1, frag1)
      else this.buildShaders(vert2, frag2)
      // prep a cube texture
      const cubeMap = gl.createTexture()
      if (cubeMap === null) throw new Error('Failed to create skybox cube map texture')
      this.cubeMap = cubeMap
    }

    updateStyle (style: StyleDefinition, camera: Camera, urlMap?: Record<string, string>): void {
      const { context } = this
      const { skybox } = style
      const { type, size, loadingBackground } = skybox ?? {}
      let path = skybox?.path
      if (typeof path !== 'string') throw new Error('Skybox path must be a string')
      if (typeof type !== 'string') throw new Error('Skybox type must be a string')
      if (typeof size !== 'number') throw new Error('Skybox size must be a number')
      path = adjustURL(path, urlMap)
      // grab clear color and set inside painter
      if (loadingBackground !== undefined) {
        context.setClearColor(
          (new Color(loadingBackground ?? 'rgb(0, 0, 0)')).getRGB()
        )
      }
      // request each face and assign to cube map
      for (let i = 0; i < 6; i++) void this.#getImage(i, `${path}/${size}/${i}.${type}`, camera)
    }

    async #getImage (index: number, path: string, camera: Camera): Promise<void> {
      const { gl } = this
      const data = await fetch(path)
        .then(async (res: Response) => {
          if (res.status !== 200 && res.status !== 206) return
          return await res.blob()
        })
        .catch(() => { return undefined })
      if (data === undefined) return
      const image = await createImageBitmap(data)
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubeMap)
      gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + index, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      // ensure size X size is a power of 2 (only way to generate mips)
      this.facesReady++
      if (this.facesReady === 6) {
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP)
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        this.renderable = true
        // set the projector as dirty to ensure a proper initial render
        camera.projector.reset()
        // call the full re-render
        camera.render()
      }
    }

    #updateMatrix (projector: Projector): void {
      const { gl, uniforms, fov, angle, matrix } = this
      const { aspect, lon, lat } = projector
      // create a perspective matrix
      perspective(matrix, fov, aspect[0] / aspect[1], 1, 10000)
      // rotate perspective
      rotate(matrix, [degToRad(lat), degToRad(lon), angle])
      // this is a simplified "lookat", since we maintain a set camera position
      multiply(matrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
      // invert view
      invert(matrix)
      // set matrix if necessary
      gl.uniformMatrix4fv(uniforms.uMatrix, false, matrix)
    }

    flush (): void { /* no-op */ }

    draw (projector: Projector): void {
      // setup variables
      const { gl, context, renderable, cubeMap } = this
      // if renderable, time to draw
      if (renderable) {
        // bind the texture cube map
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMap)
        // update  matrix if necessary
        if (projector.dirty) this.#updateMatrix(projector)
        // ignore z-fighting and only pass where stencil is 0
        context.wallpaperState()
        // Draw the geometry.
        context.drawQuad()
      }
    }
  }

  return new SkyboxProgram(context)
}
