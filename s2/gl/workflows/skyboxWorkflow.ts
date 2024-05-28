import Workflow from './workflow'
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

import type Context from '../context/context'
import type { StyleDefinition } from 'style/style.spec'
import type {
  SkyboxWorkflow as SkyboxWorkflowSpec,
  SkyboxWorkflowUniforms
} from './workflow.spec'
import type Camera from 'ui/camera'
import type Projector from 'ui/camera/projector'

export default class SkyboxWorkflow extends Workflow implements SkyboxWorkflowSpec {
  label = 'skybox' as const
  cubeMap: WebGLTexture
  facesReady = 0
  ready = false
  fov: number = degToRad(80)
  angle: number = degToRad(40)
  matrix: Float32Array = new Float32Array(16)
  declare uniforms: { [key in SkyboxWorkflowUniforms]: WebGLUniformLocation }
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
    // reset our tracking variables
    this.facesReady = 0
    this.ready = false
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
      this.ready = true
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
    perspective(matrix, fov, aspect.x / aspect.y, 1, 10000)
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

  use (): void {
    super.use()
    const { context } = this
    // ignore z-fighting and only pass where stencil is 0
    context.defaultBlend()
    context.disableCullFace()
    context.disableDepthTest()
    context.enableStencilTest()
    context.stencilFuncEqual(0)
  }

  draw (projector: Projector): void {
    // setup variables
    const { gl, context, ready, cubeMap } = this
    // let the context know the current workflow
    context.setWorkflow(this)
    // if ready, time to draw
    if (ready) {
      // bind the texture cube map
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMap)
      // update  matrix if necessary
      if (projector.dirty) this.#updateMatrix(projector)
      // Draw the skybox
      context.drawQuad()
    }
  }
}
