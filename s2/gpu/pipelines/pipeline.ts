import type { WebGPUContext } from '../context'
import type { Pipeline as PipelineSpec } from './pipeline.spec'

export default class Pipeline implements PipelineSpec {
  context: WebGPUContext
  pipeline!: GPURenderPipeline
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (
    vert: string,
    frag: string,
    buffers?: Iterable<GPUVertexBufferLayout | null>,
    primitive?: GPUPrimitiveState,
    depthStencil?: GPUDepthStencilState
  ): Promise<void> {
    const { device, format } = this.context
    this.pipeline = await buildPipeline(device, format, this.context.vpBindGroupLayout, vert, frag, buffers, primitive, depthStencil)
  }

  use (passEncoder: GPURenderPassEncoder): void {
    passEncoder.setPipeline(this.pipeline)
  }
}

// https://programmer.ink/think/several-best-practices-of-webgpu.html
// BEST PRACTICE 6: it is recommended to create pipeline asynchronously
// BEST PRACTICE 7: explicitly define pipeline layouts
async function buildPipeline (
  device: GPUDevice,
  format: GPUTextureFormat,
  layouts: GPUBindGroupLayout,
  vert: string,
  frag: string,
  buffers?: Iterable<GPUVertexBufferLayout | null>,
  primitive?: GPUPrimitiveState,
  depthStencil?: GPUDepthStencilState
): Promise<GPURenderPipeline> {
  return await device.createRenderPipelineAsync({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [layouts]
    }),
    vertex: {
      module: device.createShaderModule({ code: vert }),
      entryPoint: 'main',
      buffers
    },
    fragment: {
      module: device.createShaderModule({ code: frag }),
      entryPoint: 'main',
      targets: [{ format }]
    },
    primitive,
    depthStencil
  })
}
