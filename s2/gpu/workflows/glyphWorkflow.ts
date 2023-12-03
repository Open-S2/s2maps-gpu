/* eslint-env browser */
import shaderCode from '../shaders/glyph.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type { WebGPUContext } from '../context'
import type { GlyphFeature, GlyphSource, GlyphWorkflow as GlyphWorkflowSpec } from './workflow.spec'
import type {
  GlyphLayerDefinition,
  GlyphLayerStyle,
  GlyphWorkflowLayerGuideGPU,
  LayerDefinitionBase
} from 'style/style.spec'
import type { GlyphData, SpriteImageMessage } from 'workers/worker.spec'
import type { TileGPU as Tile } from 'source/tile.spec'
import type { GlyphImages } from 'workers/source/glyphSource'

// st (0), xy (1), offsetXY (2), wh (3), texXY (4), texWH (5)
const SUB_SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [0, 1, 2, 3, 4, 5].map(i => ({
  arrayStride: 4 * 2 * 6, // 4 bytes * 2 floats * 6 attributes
  stepMode: 'instance',
  attributes: [{
    shaderLocation: i,
    offset: i * 4 * 2, // 4 bytes * 2 floats * attribute position
    format: 'float32x2'
  }]
}))
const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  ...SUB_SHADER_BUFFER_LAYOUT,
  { // collision result index (without the proper offset)
    arrayStride: 4, // 4 bytes * 1 float
    stepMode: 'instance',
    attributes: [{
      shaderLocation: 6,
      offset: 0,
      format: 'uint32'
    }]
  },
  { // color
    arrayStride: 4 * 4, // 4 bytes * 4 floats
    stepMode: 'instance',
    attributes: [{
      shaderLocation: 7,
      offset: 0,
      format: 'float32x4'
    }]
  }
]
const SUB_TEST_SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [0, 1, 2, 3].map(i => ({
  arrayStride: 4 * 10, // 4 bytes per float * 10 floats
  stepMode: 'instance',
  attributes: [{
    shaderLocation: i,
    offset: i * 4 * 2, // 4 bytes * 2 floats * attribute position
    format: 'float32x2'
  }]
}))
const TEST_SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  ...SUB_TEST_SHADER_BUFFER_LAYOUT,
  { // collision result index (without the proper offset)
    arrayStride: 4 * 10, // 4 bytes * 1 float
    stepMode: 'instance',
    attributes: [{
      shaderLocation: 4,
      offset: 4 * 2 * 4,
      format: 'uint32'
    }]
  }
]

export default class GlyphWorkflow implements GlyphWorkflowSpec {
  context: WebGPUContext
  module!: GPUShaderModule
  layerGuides = new Map<number, GlyphWorkflowLayerGuideGPU>()
  pipeline!: GPURenderPipeline
  testRenderPipeline!: GPURenderPipeline
  bboxPipeline!: GPUComputePipeline
  testPipeline!: GPUComputePipeline
  interactivePipeline!: GPUComputePipeline
  #defaultSampler!: GPUSampler
  #texture!: GPUTexture
  #glyphBindGroupLayout!: GPUBindGroupLayout
  #glyphPipelineLayout!: GPUPipelineLayout
  #glyphFilterBindGroupLayout!: GPUBindGroupLayout
  #glyphFilterPipelineLayout!: GPUPipelineLayout
  #glyphInteractiveBindGroupLayout!: GPUBindGroupLayout
  #glyphInteractivePiplineLayout!: GPUPipelineLayout
  #glyphBBoxesBuffer!: GPUBuffer
  #glyphFilterResultBuffer!: GPUBuffer
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    const { context } = this
    const { device, frameBindGroupLayout, featureBindGroupLayout, interactiveBindGroupLayout } = context
    this.module = device.createShaderModule({ label: 'Glyph Shader Module', code: shaderCode })
    this.#defaultSampler = context.buildSampler()
    this.#texture = context.buildTexture(null, 2048, 200, 1, 'rgba8unorm')
    this.#glyphBBoxesBuffer = context.buildGPUBuffer('Glyph BBoxes Buffer', new Float32Array(Array(2_000 * 5).fill(0)), GPUBufferUsage.STORAGE)
    this.#glyphFilterResultBuffer = context.buildGPUBuffer('Glyph Filter Result Buffer', new Float32Array(Array(2_000).fill(0)), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC)
    this.#glyphFilterBindGroupLayout = device.createBindGroupLayout({
      label: 'Glyph BindGroupLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // bounds
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // uniforms
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // containers
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // bboxes
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } } // collision results
      ]
    })
    this.#glyphInteractiveBindGroupLayout = device.createBindGroupLayout({
      label: 'Glyph Interactive BindGroupLayout',
      entries: [
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // uniforms
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // containers
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // bboxes
        { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } } // collision results
      ]
    })
    this.#glyphFilterPipelineLayout = device.createPipelineLayout({
      label: 'Glyph Filter Pipeline Layout',
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.#glyphFilterBindGroupLayout]
    })
    this.#glyphInteractivePiplineLayout = device.createPipelineLayout({
      label: 'Glyph Interactive Pipeline Layout',
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.#glyphInteractiveBindGroupLayout, interactiveBindGroupLayout]
    })
    this.#glyphBindGroupLayout = device.createBindGroupLayout({
      label: 'Glyph BindGroupLayout',
      entries: [
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // glyph uniforms
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, // sampler
        { binding: 3, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, // texture
        { binding: 7, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // collision results
        { binding: 8, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } } // isStroke
      ]
    })
    this.#glyphPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.#glyphBindGroupLayout]
    })
    this.pipeline = await this.#getPipeline()
    this.testRenderPipeline = await this.#getPipeline(true)
    this.bboxPipeline = await this.#getComputePipeline('boxes')
    this.testPipeline = await this.#getComputePipeline('test')
    this.interactivePipeline = await this.#getComputePipeline('interactive')
  }

  destroy (): void {
    for (const { layerBuffer, layerCodeBuffer } of this.layerGuides.values()) {
      layerBuffer.destroy()
      layerCodeBuffer.destroy()
    }
    this.#glyphBBoxesBuffer.destroy()
    this.#glyphFilterResultBuffer.destroy()
    this.#texture.destroy()
  }

  injectImages (maxHeight: number, images: GlyphImages): void {
    const { context } = this
    const { device } = context
    // first increase texture size if needed
    this.#increaseTextureSize(maxHeight)
    // setup a command encoder to upload images all in one go
    const cE = device.createCommandEncoder()
    // upload each image to texture
    for (const { posX, posY, width, height, data } of images) {
      // first make sure width is a multiple of 256
      const paddedData = context.buildPaddedBuffer(data, width, height)
      context.uploadTextureData(this.#texture, paddedData.data, width, height, { x: posX, y: posY, z: 0 }, 1, cE)
    }
    device.queue.submit([cE.finish()])
  }

  injectSpriteImage (message: SpriteImageMessage): void {
    const { image, offsetX, offsetY, width, height, maxHeight } = message
    // first increase texture size if needed
    this.#increaseTextureSize(maxHeight)
    // then update texture
    this.context.uploadTextureData(this.#texture, image, width, height, { x: offsetX, y: offsetY, z: 0 })
  }

  #increaseTextureSize (newHeight: number): void {
    const { width, height } = this.#texture
    if (newHeight <= height) return
    const newTexture = this.context.buildTexture(this.#texture, width, newHeight, 1, 'rgba8unorm', undefined)
    this.#texture.destroy()
    this.#texture = newTexture
  }

  // programs helps design the appropriate layer parameters
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: GlyphLayerStyle): GlyphLayerDefinition {
    const { context } = this
    const { source, layerIndex, lch } = layerBase
    // PRE) get layer base
    let {
      // paint
      textSize, iconSize, textFill, textStrokeWidth, textStroke,
      // layout
      textFamily, textField, textAnchor, textOffset, textPadding, textWordWrap,
      textAlign, textKerning, textLineHeight, iconFamily, iconField, iconAnchor,
      iconOffset, iconPadding,
      // properties
      interactive, cursor, overdraw, viewCollisions
    } = layer
    textSize = textSize ?? 16
    iconSize = iconSize ?? 16
    textFill = textFill ?? 'rgb(0, 0, 0)'
    textStrokeWidth = textStrokeWidth ?? 16
    textStroke = textStroke ?? 'rgb(0, 0, 0)'
    interactive = interactive ?? false
    cursor = cursor ?? 'default'
    overdraw = overdraw ?? false
    viewCollisions = viewCollisions ?? false
    // 1) build definition
    // 1) build definition
    const layerDefinition: GlyphLayerDefinition = {
      ...layerBase,
      type: 'glyph' as const,
      // paint
      textSize,
      iconSize,
      textFill,
      textStrokeWidth,
      textStroke,
      // layout
      textFamily: textFamily ?? '',
      textField: textField ?? '',
      textAnchor: textAnchor ?? 'center',
      textOffset: textOffset ?? [0, 0],
      textPadding: textPadding ?? [0, 0],
      textWordWrap: textWordWrap ?? 0,
      textAlign: textAlign ?? 'center',
      textKerning: textKerning ?? 0,
      textLineHeight: textLineHeight ?? 0,
      iconFamily: iconFamily ?? '',
      iconField: iconField ?? '',
      iconAnchor: iconAnchor ?? 'center',
      iconOffset: iconOffset ?? [0, 0],
      iconPadding: iconPadding ?? [0, 0],
      interactive,
      cursor,
      overdraw,
      viewCollisions
    }
    // 2) build the layerCode
    const layerCode: number[] = []
    for (const paint of [textSize, iconSize, textFill, textStrokeWidth, textStroke]) {
      layerCode.push(...encodeLayerAttribute(paint, lch))
    }
    // 3) Setup layer buffers in GPU
    const layerBuffer = context.buildGPUBuffer('Layer Uniform Buffer', new Float32Array([context.getDepthPosition(layerIndex), ~~lch]), GPUBufferUsage.UNIFORM)
    const layerCodeBuffer = context.buildGPUBuffer('Layer Code Buffer', new Float32Array(layerCode), GPUBufferUsage.STORAGE)
    // 4) Store layer guide
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      layerBuffer,
      layerCodeBuffer,
      lch,
      interactive,
      cursor,
      overdraw,
      viewCollisions
    })

    return layerDefinition
  }

  buildSource (glyphData: GlyphData, tile: Tile): void {
    const { context } = this
    const { glyphFilterBuffer, glyphQuadBuffer, glyphQuadIDBuffer: glyphQuadIndexBuffer, glyphColorBuffer, featureGuideBuffer } = glyphData
    // prep buffers
    const source: GlyphSource = {
      type: 'glyph' as const,
      glyphFilterBuffer: context.buildGPUBuffer('Glyph Filter Buffer', glyphFilterBuffer, GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX),
      glyphQuadBuffer: context.buildGPUBuffer('Glyph Quad Buffer', new Float32Array(glyphQuadBuffer), GPUBufferUsage.VERTEX),
      glyphQuadIndexBuffer: context.buildGPUBuffer('Glyph Quad ID Buffer', new Uint32Array(glyphQuadIndexBuffer), GPUBufferUsage.VERTEX),
      glyphColorBuffer: context.buildGPUBuffer('Glyph Color Buffer', new Float32Array(glyphColorBuffer), GPUBufferUsage.VERTEX),
      destroy: () => {
        const { glyphFilterBuffer, glyphQuadBuffer, glyphQuadIndexBuffer, glyphColorBuffer } = source
        glyphFilterBuffer.destroy()
        glyphQuadBuffer.destroy()
        glyphQuadIndexBuffer.destroy()
        glyphColorBuffer.destroy()
      }
    }
    // build features
    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer))
  }

  #buildFeatures (source: GlyphSource, tile: Tile, featureGuideArray: Float32Array): void {
    const { context } = this
    const { device } = context
    const { mask } = tile
    const features: GlyphFeature[] = []

    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      // curlayerIndex, curType, filterOffset, filterCount, quadOffset, quadCount, encoding.length, ...encoding
      const [layerIndex, isIcon, filterOffset, filterCount, offset, count, encodingSize] = featureGuideArray.slice(i, i + 7)
      i += 7
      // If webgl1, we pull out the color and opacity otherwise build featureCode
      let featureCode: number[] = [0]
      if (encodingSize > 0) featureCode = [...featureGuideArray.slice(i, i + encodingSize)]
      // update index
      i += encodingSize

      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      const { sourceName, layerBuffer, layerCodeBuffer, lch, interactive, overdraw, viewCollisions } = layerGuide

      const glyphBoundsBuffer = context.buildGPUBuffer('Glyph Bounds Buffer', new Float32Array([0, 0, 8192, 8192]), GPUBufferUsage.UNIFORM)
      const glyphUniformBuffer = context.buildGPUBuffer('Glyph Uniform Buffer', new Float32Array([0, isIcon, ~~overdraw, 1, 1]), GPUBufferUsage.UNIFORM)
      const glyphIsStrokeBuffer = context.buildGPUBuffer('Glyph Bounds Buffer', new Float32Array([1]), GPUBufferUsage.UNIFORM)
      const glyphIsNotStrokeBuffer = context.buildGPUBuffer('Glyph Bounds Buffer', new Float32Array([0]), GPUBufferUsage.UNIFORM)
      const glyphBindGroup = device.createBindGroup({
        label: 'Glyph BindGroup',
        layout: this.#glyphBindGroupLayout,
        entries: [
          { binding: 1, resource: { buffer: glyphUniformBuffer } },
          { binding: 2, resource: this.#defaultSampler },
          { binding: 3, resource: this.#texture.createView() },
          { binding: 7, resource: { buffer: this.#glyphFilterResultBuffer } },
          { binding: 8, resource: { buffer: glyphIsNotStrokeBuffer } }
        ]
      })
      const glyphStrokeBindGroup = device.createBindGroup({
        label: 'Glyph Stroke BindGroup',
        layout: this.#glyphBindGroupLayout,
        entries: [
          { binding: 1, resource: { buffer: glyphUniformBuffer } },
          { binding: 2, resource: this.#defaultSampler },
          { binding: 3, resource: this.#texture.createView() },
          { binding: 7, resource: { buffer: this.#glyphFilterResultBuffer } },
          { binding: 8, resource: { buffer: glyphIsStrokeBuffer } }
        ]
      })
      const glyphFilterBindGroup = device.createBindGroup({
        label: 'GlyphFilter BindGroup',
        layout: this.#glyphFilterBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: glyphBoundsBuffer } },
          { binding: 1, resource: { buffer: glyphUniformBuffer } },
          { binding: 4, resource: { buffer: source.glyphFilterBuffer } },
          { binding: 5, resource: { buffer: this.#glyphBBoxesBuffer } },
          { binding: 6, resource: { buffer: this.#glyphFilterResultBuffer } }
        ]
      })
      const glyphInteractiveBindGroup = device.createBindGroup({
        label: 'Glyph Interactive BindGroup',
        layout: this.#glyphInteractiveBindGroupLayout,
        entries: [
          { binding: 1, resource: { buffer: glyphUniformBuffer } },
          { binding: 4, resource: { buffer: source.glyphFilterBuffer } },
          { binding: 5, resource: { buffer: this.#glyphBBoxesBuffer } },
          { binding: 7, resource: { buffer: this.#glyphFilterResultBuffer } }
        ]
      })
      const featureCodeBuffer = context.buildGPUBuffer('Feature Code Buffer', new Float32Array(featureCode), GPUBufferUsage.STORAGE)
      const bindGroup = context.buildGroup(
        'Feature BindGroup',
        context.featureBindGroupLayout,
        [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
      )

      const feature: GlyphFeature = {
        type: 'glyph' as const,
        source,
        tile,
        count,
        offset,
        filterCount,
        filterOffset,
        sourceName,
        layerIndex,
        featureCode,
        lch,
        interactive,
        overdraw,
        viewCollisions,
        isIcon: isIcon === 1,
        bindGroup,
        glyphBindGroup,
        glyphStrokeBindGroup,
        glyphFilterBindGroup,
        glyphInteractiveBindGroup,
        glyphUniformBuffer,
        draw: () => { this.draw(feature) },
        compute: () => { this.computeInteractive(feature) },
        destroy: () => {
          glyphBoundsBuffer.destroy()
          glyphUniformBuffer.destroy()
          glyphIsStrokeBuffer.destroy()
          glyphIsNotStrokeBuffer.destroy()
          featureCodeBuffer.destroy()
        }
      }

      features.push(feature)
    }

    tile.addFeatures(features)
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 6: it is recommended to create pipeline asynchronously (we don't want to because we WANT to block the main thread)
  // BEST PRACTICE 7: explicitly define pipeline layouts
  async #getPipeline (isTest = false): Promise<GPURenderPipeline> {
    const { context, module } = this
    const { device, format, defaultBlend, sampleCount } = context

    const stencilState: GPUStencilFaceState = {
      compare: 'always',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace'
    }

    return await device.createRenderPipelineAsync({
      label: `Glyph Pipeline ${isTest ? 'Test' : 'Main'}`,
      layout: this.#glyphPipelineLayout,
      vertex: {
        module,
        entryPoint: isTest ? 'vTest' : 'vMain',
        buffers: isTest ? TEST_SHADER_BUFFER_LAYOUT : SHADER_BUFFER_LAYOUT
      },
      fragment: {
        module,
        entryPoint: isTest ? 'fTest' : 'fMain',
        targets: [{ format, blend: defaultBlend }]
      },
      primitive: {
        topology: isTest ? 'line-list' : 'triangle-list',
        cullMode: 'none'
      },
      multisample: { count: sampleCount },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less-equal',
        format: 'depth24plus-stencil8',
        stencilFront: stencilState,
        stencilBack: stencilState,
        stencilReadMask: 0xFFFFFFFF,
        stencilWriteMask: 0xFFFFFFFF
      }
    })
  }

  async #getComputePipeline (entryPoint: 'boxes' | 'test' | 'interactive'): Promise<GPUComputePipeline> {
    const { context, module } = this

    return await context.device.createComputePipelineAsync({
      label: `Glyph Filter ${entryPoint} Compute Pipeline`,
      layout: entryPoint === 'interactive' ? this.#glyphInteractivePiplineLayout : this.#glyphFilterPipelineLayout,
      compute: { module, entryPoint }
    })
  }

  computeFilters (features: GlyphFeature[]): void {
    if (features.length === 0) return
    const { context, bboxPipeline, testPipeline } = this
    const { device, frameBufferBindGroup } = context
    // prepare
    const commandEncoder = device.createCommandEncoder()
    const computePass = commandEncoder.beginComputePass()
    computePass.setBindGroup(0, frameBufferBindGroup)

    // Step 1: build bboxes
    computePass.setPipeline(bboxPipeline)
    let filterCountOffset = 0
    for (const { glyphUniformBuffer, bindGroup, glyphFilterBindGroup, filterCount } of features) {
      // update the glyphUniformBuffer's indexOffset for each feature
      device.queue.writeBuffer(glyphUniformBuffer, 0, new Uint32Array([filterCountOffset]))
      // set bind groups
      computePass.setBindGroup(1, bindGroup)
      computePass.setBindGroup(2, glyphFilterBindGroup)
      computePass.dispatchWorkgroups(Math.ceil(filterCount / 64))
      filterCountOffset += filterCount
    }
    // Step 2: test bboxes against each other
    computePass.setPipeline(testPipeline)
    computePass.dispatchWorkgroups(Math.ceil(filterCountOffset / 64))

    // finish
    computePass.end()
    device.queue.submit([commandEncoder.finish()])
  }

  computeInteractive (feature: GlyphFeature): void {
    const { interactiveBindGroup, computePass } = this.context
    const { bindGroup, glyphInteractiveBindGroup, filterCount } = feature
    // set pipeline
    this.context.setComputePipeline(this.interactivePipeline)
    // set bind groups
    computePass.setBindGroup(1, bindGroup)
    computePass.setBindGroup(2, glyphInteractiveBindGroup)
    computePass.setBindGroup(3, interactiveBindGroup)
    // draw
    computePass.dispatchWorkgroups(Math.ceil(filterCount / 64))
  }

  draw ({
    viewCollisions,
    isIcon,
    bindGroup,
    glyphBindGroup,
    glyphStrokeBindGroup,
    source,
    count,
    offset,
    filterCount,
    filterOffset
  }: GlyphFeature): void {
    // get current source data
    const { context, pipeline } = this
    const { passEncoder } = context
    const { glyphQuadBuffer, glyphFilterBuffer, glyphQuadIndexBuffer, glyphColorBuffer } = source

    // setup pipeline, bind groups, & buffers
    context.setRenderPipeline(pipeline)
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setVertexBuffer(0, glyphQuadBuffer)
    passEncoder.setVertexBuffer(1, glyphQuadBuffer)
    passEncoder.setVertexBuffer(2, glyphQuadBuffer)
    passEncoder.setVertexBuffer(3, glyphQuadBuffer)
    passEncoder.setVertexBuffer(4, glyphQuadBuffer)
    passEncoder.setVertexBuffer(5, glyphQuadBuffer)
    passEncoder.setVertexBuffer(6, glyphQuadIndexBuffer)
    passEncoder.setVertexBuffer(7, glyphColorBuffer)
    // draw
    if (!isIcon) {
      passEncoder.setBindGroup(2, glyphStrokeBindGroup)
      passEncoder.draw(6, count, 0, offset)
    }
    passEncoder.setBindGroup(2, glyphBindGroup)
    passEncoder.draw(6, count, 0, offset)
    // draw test if needed
    if (viewCollisions) {
      context.setRenderPipeline(this.testRenderPipeline)
      passEncoder.setVertexBuffer(0, glyphFilterBuffer)
      passEncoder.setVertexBuffer(1, glyphFilterBuffer)
      passEncoder.setVertexBuffer(2, glyphFilterBuffer)
      passEncoder.setVertexBuffer(3, glyphFilterBuffer)
      passEncoder.setVertexBuffer(4, glyphFilterBuffer)
      passEncoder.draw(8, filterCount, 0, filterOffset)
    }
  }
}
