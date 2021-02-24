// @flow
/* global GPUCanvasContext */
import type { MapOptions } from '../../ui/map'

export default class WebGPUContext {
  adapter: any
  device: any
  swapchain: any
  context: GPUCanvasContext
  swapchainFormat: string = 'bgra8unorm'
  type: 3 = 3 // specifying that we are using a WebGPUContext
  constructor (context: GPUCanvasContext, options: MapOptions) {
    console.log(context)
    this.context = context
    // create a default quad
    this.connectGPU()
  }

  async connectGPU () {
    // physical device adapter
    const adapter = this.adapter = await navigator.gpu.requestAdapter()
    // 💻 logical device
    const device = this.device = await adapter.requestDevice()
    // ⛓️ create swapchain
    this.swapchain = this.context.configureSwapChain({
        device,
        format: this.swapchainFormat
    })
  }
}
