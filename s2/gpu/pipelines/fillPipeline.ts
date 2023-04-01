// @ts-nocheck
/* eslint-env browser */
// import Program from './program'

import vert from '../shaders/fill.vert.wgsl'
import frag from '../shaders/fill.frag.wgsl'

import type { WebGPUContext } from '../context'
import { FillFeatureGuide } from '../../gl'

export default class FillPipeline {
  context: WebGPUContext
  pipeline!: GPURenderPipeline
  constructor (context: WebGPUContext) {
    this.context = context
  }

  buildPipeline (): void {
    const { device, format } = this.context
    this.pipeline = device.createRenderPipeline({
      vertex: {
        module: device.createShaderModule({
          code: vert
        }),
        entryPoint: 'main'
      },
      fragment: {
        module: device.createShaderModule({
          code: frag
        }),
        entryPoint: 'main',
        targets: [{ format }]
      },
      primitive: { topology: 'triangle-list' },
      multisample: { count: 4 },
      layout: 'auto'
    })
  }

  use (passEncoder: GPURenderPassEncoder): void {
    passEncoder.setPipeline(this.pipeline)
    passEncoder.setBindGroup(1, this.#modelBufferBindGroup)
    super.use()
  }

  draw (featureGuide: FillFeatureGuide, passEncoder: GPURenderPassEncoder): void {
    // get current source data
    const { count, depthPos, featureCode, offset } = featureGuide
    // set feature code (webgl 1 we store the colors, webgl 2 we store layerCode lookups)
    this.setFeatureCode(featureCode)
    // draw
    passEncoder.setPipeline(this.pipeline)
    passEncoder.setVertexBuffer(0, this.#vertBuffer)
    passEncoder.draw(count, 1, offset, 0)
  }
}
