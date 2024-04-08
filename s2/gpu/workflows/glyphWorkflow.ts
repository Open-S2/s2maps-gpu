import shaderCode from '../shaders/glyph.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type { WebGPUContext } from '../context'
import type {
  GlyphFeature as GlyphFeatureSpec,
  GlyphSource,
  GlyphWorkflow as GlyphWorkflowSpec
} from './workflow.spec'
import type {
  GlyphDefinition,
  GlyphStyle,
  GlyphWorkflowLayerGuideGPU,
  LayerDefinitionBase
} from 'style/style.spec'
import type { GlyphData } from 'workers/worker.spec'
import type { TileGPU as Tile } from 'source/tile.spec'
import type { BBox } from 'geometry'

// st (0), adjustXY (1), xy (2), wh (3), texXY (4), texWH (5)
const SUB_SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [0, 1, 2, 3, 4, 5].map(i => ({
  arrayStride: 6 * 4 * 2, // 6 attributes * 4 bytes * 2 floats
  stepMode: 'instance',
  attributes: [{
    shaderLocation: i,
    offset: i * 4 * 2, // attribute position * 4 bytes * 2 floats
    format: 'float32x2'
  }]
}))
// st - offsetXY (0), xy - wh (1), texXY - textWH (2), paths12 (3), paths34 (4)
const SUB_SHADER_BUFFER_LAYOUT_PATH: Iterable<GPUVertexBufferLayout> = [0, 1, 2, 3, 4].map(i => ({
  arrayStride: 5 * 4 * 4, // 5 attributes * 4 floats * 4 bytes
  stepMode: 'instance',
  attributes: [{
    shaderLocation: i,
    offset: i * 4 * 4, // attribute position * 4 floats * 4 bytes
    format: 'float32x4'
  }]
}))
const SHADER_BUFFER_COLLISION_COLOR_LAYOUT: (l: number) => Iterable<GPUVertexBufferLayout> = (location: number) => [
  { // collision result index (without the proper offset)
    arrayStride: 4, // 4 bytes * 1 float
    stepMode: 'instance',
    attributes: [{
      shaderLocation: location,
      offset: 0,
      format: 'uint32'
    }]
  },
  { // color
    arrayStride: 4 * 4, // 4 floats * 4 bytes
    stepMode: 'instance',
    attributes: [{
      shaderLocation: location + 1,
      offset: 0,
      format: 'float32x4'
    }]
  }
]
const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  ...SUB_SHADER_BUFFER_LAYOUT,
  ...SHADER_BUFFER_COLLISION_COLOR_LAYOUT(6)
]
const SHADER_BUFFER_LAYOUT_PATH: Iterable<GPUVertexBufferLayout> = [
  ...SUB_SHADER_BUFFER_LAYOUT_PATH,
  ...SHADER_BUFFER_COLLISION_COLOR_LAYOUT(5)
]
const SUB_TEST_SHADER_BUFFER_LAYOUT_ATTR: Iterable<GPUVertexAttribute> = [0, 1, 2, 3, 4].map(i => ({
  shaderLocation: i,
  offset: i * 4 * 2, // 4 bytes * 2 floats * attribute position
  format: 'float32x2'
}))
const TEST_SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  { // collision result index (without the proper offset)
    arrayStride: 4 * 18, // 4 bytes * 1 uint32 at 18 float intervals
    stepMode: 'instance',
    attributes: [
      ...SUB_TEST_SHADER_BUFFER_LAYOUT_ATTR,
      {
        shaderLocation: 5,
        offset: 4 * 10, // 4 bytes * 15 floats prior
        format: 'uint32'
      }
    ]
  }
]
// the reason for the stride being 18 not 16 is to allow for the padding of the unused ID
// which you can see inside the glyph.wgsl struct `GlyphContainerPath`
const TEST_SHADER_BUFFER_LAYOUT_PATH: Iterable<GPUVertexBufferLayout> = [
  {
    arrayStride: 4 * 18, // 4 bytes per float * 18 floats total
    stepMode: 'instance',
    attributes: [
      // st
      { shaderLocation: 0, offset: 0, format: 'float32x2' },
      // offset (location 1 * 4 bytes per float * 2 floats)
      { shaderLocation: 1, offset: 1 * 4 * 2, format: 'float32x2' },
      // xy (4 bytes per float * 4 floats prior)
      { shaderLocation: 2, offset: 4 * 4, format: 'float32x2' },
      // stPaths12 (4 bytes per float * 6 floats prior)
      { shaderLocation: 3, offset: 4 * 6, format: 'float32x4' },
      // stPaths34 (4 bytes per float * 10 floats prior)
      { shaderLocation: 4, offset: 4 * 10, format: 'float32x4' },
      // padding (4 bytes per float * 14 floats prior)
      { shaderLocation: 5, offset: 4 * 14, format: 'float32' },
      // collision result index (4 bytes per float * 15 floats prior)
      { shaderLocation: 6, offset: 4 * 15, format: 'uint32' }
    ]
  }
]

export class GlyphFeature implements GlyphFeatureSpec {
  type = 'glyph' as const
  bindGroup: GPUBindGroup
  glyphBindGroup: GPUBindGroup
  glyphStrokeBindGroup: GPUBindGroup
  glyphFilterBindGroup: GPUBindGroup
  glyphInteractiveBindGroup: GPUBindGroup
  constructor (
    public workflow: GlyphWorkflowSpec,
    public source: GlyphSource,
    public tile: Tile,
    public layerGuide: GlyphWorkflowLayerGuideGPU,
    public count: number,
    public offset: number,
    public filterCount: number,
    public filterOffset: number,
    public isPath: boolean,
    public isIcon: boolean,
    public featureCode: number[],
    public glyphUniformBuffer: GPUBuffer,
    public glyphBoundsBuffer: GPUBuffer,
    public glyphAttributeBuffer: GPUBuffer,
    public glyphAttributeNoStrokeBuffer: GPUBuffer,
    public featureCodeBuffer: GPUBuffer,
    public parent?: Tile
  ) {
    this.bindGroup = this.#buildBindGroup()
    this.glyphBindGroup = this.#buildGlyphBindGroup()
    this.glyphStrokeBindGroup = this.#buildStrokeBindGroup()
    this.glyphFilterBindGroup = this.#buildFilterBindGroup()
    this.glyphInteractiveBindGroup = this.#buildInteractiveBindGroup()
  }

  draw (): void {
    this.workflow.draw(this)
  }

  compute (): void {
    this.workflow.computeInteractive(this)
  }

  updateSharedTexture (): void {
    this.glyphBindGroup = this.#buildGlyphBindGroup()
    this.glyphStrokeBindGroup = this.#buildStrokeBindGroup()
  }

  destroy (): void {
    this.glyphBoundsBuffer.destroy()
    this.glyphUniformBuffer.destroy()
    this.glyphAttributeBuffer.destroy()
    this.glyphAttributeNoStrokeBuffer.destroy()
    this.featureCodeBuffer.destroy()
  }

  duplicate (tile: Tile, parent?: Tile, bounds?: BBox): GlyphFeature {
    const {
      workflow, source, layerGuide, featureCodeBuffer, count, offset,
      filterCount, filterOffset, isPath, isIcon, featureCode,
      glyphBoundsBuffer, glyphUniformBuffer,
      glyphAttributeBuffer, glyphAttributeNoStrokeBuffer
    } = this
    const { context } = workflow
    const cE = context.device.createCommandEncoder()
    const newGlyphBoundsBuffer = bounds !== undefined
      ? context.buildGPUBuffer('Glyph Bounds Buffer', new Float32Array(bounds), GPUBufferUsage.UNIFORM)
      : context.duplicateGPUBuffer(glyphBoundsBuffer, cE)
    const newGlyphUniformBuffer = context.duplicateGPUBuffer(glyphUniformBuffer, cE)
    const newGlyphAttributeBuffer = context.duplicateGPUBuffer(glyphAttributeBuffer, cE)
    const newGlyphAttributeNoStrokeBuffer = context.duplicateGPUBuffer(glyphAttributeNoStrokeBuffer, cE)
    const newFeatureCodeBuffer = context.duplicateGPUBuffer(featureCodeBuffer, cE)
    context.device.queue.submit([cE.finish()])
    return new GlyphFeature(
      workflow, source, tile, layerGuide, count, offset, filterCount, filterOffset,
      isPath, isIcon, featureCode, newGlyphUniformBuffer, newGlyphBoundsBuffer,
      newGlyphAttributeBuffer, newGlyphAttributeNoStrokeBuffer,
      newFeatureCodeBuffer, parent
    )
  }

  #buildBindGroup (): GPUBindGroup {
    const { workflow, tile, parent, layerGuide, featureCodeBuffer } = this
    const { context } = workflow
    const { mask } = parent ?? tile
    const { layerBuffer, layerCodeBuffer } = layerGuide
    return context.buildGroup(
      'Glyph Feature BindGroup',
      context.featureBindGroupLayout,
      [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
    )
  }

  #buildGlyphBindGroup (): GPUBindGroup {
    const { glyphUniformBuffer, glyphAttributeNoStrokeBuffer } = this
    return this.#buildGlyphBindGroupContext(glyphUniformBuffer, glyphAttributeNoStrokeBuffer)
  }

  #buildStrokeBindGroup (): GPUBindGroup {
    const { glyphUniformBuffer, glyphAttributeBuffer } = this
    return this.#buildGlyphBindGroupContext(glyphUniformBuffer, glyphAttributeBuffer, true)
  }

  #buildGlyphBindGroupContext (
    glyphUniformBuffer: GPUBuffer,
    glyphAttributeBuffer: GPUBuffer,
    isStroke = false
  ): GPUBindGroup {
    const { context, glyphBindGroupLayout, glyphFilterResultBuffer } = this.workflow
    const { device, defaultSampler, sharedTexture } = context
    return device.createBindGroup({
      label: `Glyph ${isStroke ? 'Stroke' : ''} BindGroup`,
      layout: glyphBindGroupLayout,
      entries: [
        { binding: 1, resource: { buffer: glyphUniformBuffer } },
        { binding: 2, resource: defaultSampler },
        { binding: 3, resource: sharedTexture.createView() },
        { binding: 8, resource: { buffer: glyphFilterResultBuffer } },
        { binding: 9, resource: { buffer: glyphAttributeBuffer } }
      ]
    })
  }

  #buildFilterBindGroup (): GPUBindGroup {
    const { workflow, source, glyphBoundsBuffer, glyphUniformBuffer, glyphAttributeBuffer } = this
    const { context, glyphFilterBindGroupLayout, glyphBBoxesBuffer, glyphFilterResultBuffer } = workflow
    return context.device.createBindGroup({
      label: 'GlyphFilter BindGroup',
      layout: glyphFilterBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: glyphBoundsBuffer } },
        { binding: 1, resource: { buffer: glyphUniformBuffer } },
        // assign the filter to both 4 or 5 as later the right binding will be used
        { binding: 4, resource: { buffer: source.glyphFilterBuffer } },
        { binding: 5, resource: { buffer: source.glyphFilterBuffer } },
        { binding: 6, resource: { buffer: glyphBBoxesBuffer } },
        { binding: 7, resource: { buffer: glyphFilterResultBuffer } },
        { binding: 9, resource: { buffer: glyphAttributeBuffer } }
      ]
    })
  }

  #buildInteractiveBindGroup (): GPUBindGroup {
    const { workflow, source, glyphUniformBuffer, glyphAttributeBuffer } = this
    const { context, glyphInteractiveBindGroupLayout, glyphBBoxesBuffer, glyphFilterResultBuffer } = workflow
    return context.device.createBindGroup({
      label: 'Glyph Interactive BindGroup',
      layout: glyphInteractiveBindGroupLayout,
      entries: [
        { binding: 1, resource: { buffer: glyphUniformBuffer } },
        { binding: 4, resource: { buffer: source.glyphFilterBuffer } },
        { binding: 5, resource: { buffer: source.glyphFilterBuffer } },
        { binding: 6, resource: { buffer: glyphBBoxesBuffer } },
        { binding: 8, resource: { buffer: glyphFilterResultBuffer } },
        { binding: 9, resource: { buffer: glyphAttributeBuffer } }
      ]
    })
  }
}

export default class GlyphWorkflow implements GlyphWorkflowSpec {
  context: WebGPUContext
  module!: GPUShaderModule
  layerGuides = new Map<number, GlyphWorkflowLayerGuideGPU>()
  pipeline!: GPURenderPipeline
  pipelineC!: GPURenderPipeline
  testRenderPipeline!: GPURenderPipeline
  testCircleRenderPipeline!: GPURenderPipeline
  bboxPipeline!: GPUComputePipeline
  circlePipeline!: GPUComputePipeline
  testFiltersPipeline!: GPUComputePipeline
  testCirclePipeline!: GPUComputePipeline
  interactivePipeline!: GPUComputePipeline
  glyphBindGroupLayout!: GPUBindGroupLayout
  glyphPipelineLayout!: GPUPipelineLayout
  glyphFilterBindGroupLayout!: GPUBindGroupLayout
  glyphFilterPipelineLayout!: GPUPipelineLayout
  glyphInteractiveBindGroupLayout!: GPUBindGroupLayout
  glyphInteractivePiplineLayout!: GPUPipelineLayout
  glyphBBoxesBuffer!: GPUBuffer
  glyphFilterResultBuffer!: GPUBuffer
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    const { context } = this
    const { device, frameBindGroupLayout, featureBindGroupLayout, interactiveBindGroupLayout } = context
    this.module = device.createShaderModule({ label: 'Glyph Shader Module', code: shaderCode })
    this.glyphBBoxesBuffer = context.buildGPUBuffer('Glyph BBoxes Buffer', new Float32Array(Array(2_000 * 5).fill(0)), GPUBufferUsage.STORAGE)
    this.glyphFilterResultBuffer = context.buildGPUBuffer('Glyph Filter Result Buffer', new Float32Array(Array(2_000).fill(0)), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC)
    this.glyphFilterBindGroupLayout = device.createBindGroupLayout({
      label: 'Glyph Filter BindGroupLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // bounds
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // uniforms
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // containers
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // pathContainers
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // bboxes
        { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // collision results
        { binding: 9, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } } // [offset, count, isStroke]
      ]
    })
    this.glyphInteractiveBindGroupLayout = device.createBindGroupLayout({
      label: 'Glyph Interactive BindGroupLayout',
      entries: [
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // uniforms
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // containers
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // pathContainers
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // bboxes
        { binding: 8, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // collision results
        { binding: 9, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } } // [offset, count, isStroke]
      ]
    })
    this.glyphFilterPipelineLayout = device.createPipelineLayout({
      label: 'Glyph Filter Pipeline Layout',
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.glyphFilterBindGroupLayout]
    })
    this.glyphInteractivePiplineLayout = device.createPipelineLayout({
      label: 'Glyph Interactive Pipeline Layout',
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.glyphInteractiveBindGroupLayout, interactiveBindGroupLayout]
    })
    this.glyphBindGroupLayout = device.createBindGroupLayout({
      label: 'Glyph BindGroupLayout',
      entries: [
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // glyph uniforms
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, // sampler
        { binding: 3, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, // texture
        { binding: 8, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // collision results
        { binding: 9, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } } // [offset, count, isStroke]
      ]
    })
    this.glyphPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.glyphBindGroupLayout]
    })
    this.pipeline = this.#getPipeline()
    this.pipelineC = this.#getPipeline(false, true)
    this.testRenderPipeline = this.#getPipeline(true)
    this.testCircleRenderPipeline = this.#getPipeline(true, true)
    this.bboxPipeline = this.#getComputePipeline('boxes')
    this.circlePipeline = this.#getComputePipeline('circles')
    this.testFiltersPipeline = this.#getComputePipeline('test')
    this.interactivePipeline = this.#getComputePipeline('interactive')
  }

  destroy (): void {
    for (const { layerBuffer, layerCodeBuffer } of this.layerGuides.values()) {
      layerBuffer.destroy()
      layerCodeBuffer.destroy()
    }
    this.glyphBBoxesBuffer.destroy()
    this.glyphFilterResultBuffer.destroy()
  }

  // workflow helps design the appropriate layer parameters
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: GlyphStyle): GlyphDefinition {
    const { context } = this
    const { source, layerIndex, lch, visible } = layerBase
    // PRE) get layer base
    let {
      // paint
      textSize, iconSize, textFill, textStrokeWidth, textStroke,
      // layout
      placement, spacing,
      textFamily, textField, textAnchor, textOffset, textPadding,
      textWordWrap, textAlign, textKerning, textLineHeight,
      iconFamily, iconField, iconAnchor, iconOffset, iconPadding,
      // properties
      geoFilter,
      interactive, cursor, overdraw, noShaping, viewCollisions
    } = layer
    textSize = textSize ?? 16
    iconSize = iconSize ?? 16
    textFill = textFill ?? 'rgb(0, 0, 0)'
    textStrokeWidth = textStrokeWidth ?? 0
    textStroke = textStroke ?? 'rgb(0, 0, 0)'
    geoFilter = geoFilter ?? []
    interactive = interactive ?? false
    cursor = cursor ?? 'default'
    overdraw = overdraw ?? false
    noShaping = noShaping ?? false
    viewCollisions = viewCollisions ?? false
    // 1) build definition
    const layerDefinition: GlyphDefinition = {
      ...layerBase,
      type: 'glyph' as const,
      // paint
      textSize,
      iconSize,
      textFill,
      textStrokeWidth,
      textStroke,
      // layout
      placement: placement ?? 'line',
      spacing: spacing ?? 325,
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
      // properties
      geoFilter,
      interactive,
      cursor,
      overdraw,
      noShaping,
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
      viewCollisions,
      visible,
      opaque: false
    })

    return layerDefinition
  }

  buildSource (glyphData: GlyphData, tile: Tile): void {
    const { context } = this
    const { glyphFilterBuffer, glyphQuadBuffer, glyphQuadIDBuffer: glyphQuadIndexBuffer, glyphColorBuffer, featureGuideBuffer } = glyphData
    // prep buffers
    const filterLength = glyphFilterBuffer.byteLength / 4 / 18 // 4 bytes per float at 18 float intervals
    const source: GlyphSource = {
      type: 'glyph' as const,
      glyphFilterBuffer: context.buildGPUBuffer('Glyph Filter Buffer', glyphFilterBuffer, GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX),
      glyphQuadBuffer: context.buildGPUBuffer('Glyph Quad Buffer', glyphQuadBuffer, GPUBufferUsage.VERTEX),
      glyphQuadIndexBuffer: context.buildGPUBuffer('Glyph Quad ID Buffer', glyphQuadIndexBuffer, GPUBufferUsage.VERTEX),
      glyphColorBuffer: context.buildGPUBuffer('Glyph Color Buffer', new Float32Array(glyphColorBuffer), GPUBufferUsage.VERTEX),
      indexOffset: -1,
      filterLength,
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
    const features: GlyphFeatureSpec[] = []

    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      // curlayerIndex, curType, filterOffset, filterCount, quadOffset, quadCount, encoding.length, ...encoding
      const [
        layerIndex, isPath, isIcon, filterOffset, filterCount,
        offset, count, encodingSize
      ] = featureGuideArray.slice(i, i + 8)
      i += 8
      // If webgl1, we pull out the color and opacity otherwise build featureCode
      let featureCode: number[] = [0]
      if (encodingSize > 0) featureCode = [...featureGuideArray.slice(i, i + encodingSize)]
      // update index
      i += encodingSize

      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      const { overdraw } = layerGuide

      const glyphBoundsBuffer = context.buildGPUBuffer('Glyph Bounds Buffer', new Float32Array([0, 0, 1, 1]), GPUBufferUsage.UNIFORM)
      const glyphUniformBuffer = context.buildGPUBuffer('Glyph Uniform Buffer', new Float32Array([0, isPath, isIcon, ~~overdraw, 1, 1]), GPUBufferUsage.UNIFORM)
      const glyphAttributeBuffer = context.buildGPUBuffer('Glyph Attributes with Stroke Buffer', new Uint32Array([filterOffset, filterCount, 1]), GPUBufferUsage.UNIFORM)
      const glyphAttributeNoStrokeBuffer = context.buildGPUBuffer('Glyph Attributes Buffer', new Uint32Array([filterOffset, filterCount, 0]), GPUBufferUsage.UNIFORM)
      const featureCodeBuffer = context.buildGPUBuffer('Feature Code Buffer', new Float32Array(featureCode), GPUBufferUsage.STORAGE)
      const feature = new GlyphFeature(
        this, source, tile, layerGuide, count, offset, filterCount, filterOffset,
        isPath === 1, isIcon === 1, featureCode, glyphUniformBuffer, glyphBoundsBuffer,
        glyphAttributeBuffer, glyphAttributeNoStrokeBuffer, featureCodeBuffer
      )

      features.push(feature)
    }

    tile.addFeatures(features)
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 6: it is recommended to create pipeline asynchronously (we don't want to because we WANT to block the main thread)
  // BEST PRACTICE 7: explicitly define pipeline layouts
  #getPipeline (isTest = false, isPath = false): GPURenderPipeline {
    const { context, module } = this
    const { device, format, defaultBlend, sampleCount } = context

    const stencilState: GPUStencilFaceState = {
      compare: 'always',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace'
    }

    const namingPathPoint = isPath ? ' Path' : ''
    const namingTestMain = isTest ? 'Test' : 'Main'
    const vEntryPoint = `v${isPath ? 'Path' : ''}${namingTestMain}`

    return device.createRenderPipeline({
      label: `Glyph Pipeline${namingPathPoint} ${namingTestMain}`,
      layout: this.glyphPipelineLayout,
      vertex: {
        module,
        entryPoint: vEntryPoint,
        buffers: isTest
          ? isPath
            ? TEST_SHADER_BUFFER_LAYOUT_PATH
            : TEST_SHADER_BUFFER_LAYOUT
          : isPath
            ? SHADER_BUFFER_LAYOUT_PATH
            : SHADER_BUFFER_LAYOUT
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

  #getComputePipeline (entryPoint: 'boxes' | 'circles' | 'test' | 'interactive'): GPUComputePipeline {
    const { context, module } = this

    return context.device.createComputePipeline({
      label: `Glyph Filter ${entryPoint} Compute Pipeline`,
      layout: entryPoint === 'interactive' ? this.glyphInteractivePiplineLayout : this.glyphFilterPipelineLayout,
      compute: { module, entryPoint }
    })
  }

  computeFilters (features: GlyphFeatureSpec[]): void {
    if (features.length === 0) return
    const { context, bboxPipeline, circlePipeline, testFiltersPipeline } = this
    const { device, frameBufferBindGroup } = context
    const { ceil } = Math
    // prepare
    const commandEncoder = device.createCommandEncoder()
    const computePass = this.context.computePass = commandEncoder.beginComputePass()
    computePass.setBindGroup(0, frameBufferBindGroup)

    // Step 1: Setup source offsets
    // a: reset source offsets to 0
    for (const { source } of features) source.indexOffset = -1
    // b: update source offsets and assign to glyphUniformBuffer
    let filterCountOffset = 0
    for (const { source, glyphUniformBuffer } of features) {
      if (source.indexOffset === -1) {
        source.indexOffset = filterCountOffset
        filterCountOffset += source.filterLength
      }
      device.queue.writeBuffer(glyphUniformBuffer, 0, new Uint32Array([source.indexOffset]))
    }

    // Step 2: build bboxes or circles
    for (const { isPath, bindGroup, glyphFilterBindGroup, filterCount } of features) {
      context.setComputePipeline(isPath ? circlePipeline : bboxPipeline)
      // set bind groups
      computePass.setBindGroup(1, bindGroup)
      computePass.setBindGroup(2, glyphFilterBindGroup)
      computePass.dispatchWorkgroups(ceil(filterCount / 64))
    }
    // Step 3: test bboxes against each other
    context.setComputePipeline(testFiltersPipeline)
    computePass.dispatchWorkgroups(ceil(filterCountOffset / 64))

    // finish
    computePass.end()
    device.queue.submit([commandEncoder.finish()])
  }

  computeInteractive (feature: GlyphFeatureSpec): void {
    const { context, interactivePipeline } = this
    const { interactiveBindGroup, computePass } = context
    const { bindGroup, glyphInteractiveBindGroup, filterCount } = feature
    // set pipeline
    context.setComputePipeline(interactivePipeline)
    // set bind groups
    computePass.setBindGroup(1, bindGroup)
    computePass.setBindGroup(2, glyphInteractiveBindGroup)
    computePass.setBindGroup(3, interactiveBindGroup)
    // draw
    computePass.dispatchWorkgroups(Math.ceil(filterCount / 64))
  }

  draw ({
    layerGuide: { viewCollisions, visible }, isPath, isIcon,
    bindGroup, glyphBindGroup, glyphStrokeBindGroup, source,
    count, offset, filterCount, filterOffset
  }: GlyphFeatureSpec): void {
    if (!visible) return
    // get current source data
    const {
      context, pipeline, pipelineC, testRenderPipeline, testCircleRenderPipeline
    } = this
    const {
      glyphQuadBuffer, glyphFilterBuffer, glyphQuadIndexBuffer, glyphColorBuffer
    } = source
    const { passEncoder } = context

    // setup pipeline, bind groups, & buffers
    context.setRenderPipeline(isPath ? pipelineC : pipeline)
    passEncoder.setBindGroup(1, bindGroup)
    for (let i = 0; i <= 4; i++) passEncoder.setVertexBuffer(i, glyphQuadBuffer)
    if (isPath) {
      passEncoder.setVertexBuffer(5, glyphQuadIndexBuffer)
      passEncoder.setVertexBuffer(6, glyphColorBuffer)
    } else {
      passEncoder.setVertexBuffer(5, glyphQuadBuffer)
      passEncoder.setVertexBuffer(6, glyphQuadIndexBuffer)
      passEncoder.setVertexBuffer(7, glyphColorBuffer)
    }
    // draw
    if (!isIcon) {
      passEncoder.setBindGroup(2, glyphStrokeBindGroup)
      passEncoder.draw(6, count, 0, offset)
    }
    passEncoder.setBindGroup(2, glyphBindGroup)
    passEncoder.draw(6, count, 0, offset)
    // draw test if needed
    if (viewCollisions) {
      context.setRenderPipeline(isPath ? testCircleRenderPipeline : testRenderPipeline)
      for (let i = 0; i <= 5; i++) passEncoder.setVertexBuffer(i, glyphFilterBuffer)
      if (isPath) passEncoder.setVertexBuffer(6, glyphFilterBuffer)
      passEncoder.draw(isPath ? 64 : 8, filterCount, 0, filterOffset)
    }
  }
}
