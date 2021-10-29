// @flow
import type { MapOptions } from '../../ui/map'

export default class WebGPUContext {
  adapter: any
  device: any
  swapchain: any
  gl: GPUCanvasContext
  devicePixelRatio: number
  interactive: boolean
  format: string
  type: number = 3 // specifying that we are using a WebGPUContext
  constructor (context: GPUCanvasContext, options: MapOptions) {
    const { canvasMultiplier, interactive } = options
    this.gl = context
    this.devicePixelRatio = canvasMultiplier
    this.interactive = interactive
  }

  async connectGPU () {
    const { gl } = this
    // grab physical device adapter and device
    const adapter = this.adapter = await navigator.gpu.requestAdapter()
    this.device = await adapter.requestDevice()
    // configure context
    this.format = gl.getPreferredFormat(adapter)
    this.resize()
  }

  resize () {
    const { gl, device, format, devicePixelRatio } = this
    gl.configure({ device, format, size: [gl.canvas.width * devicePixelRatio, gl.canvas.height * devicePixelRatio] })
  }
}
