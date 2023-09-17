/* eslint-env browser */
import { WebGPUContext } from './context'

import type { MapOptions } from 'ui/s2mapUI'
import type { FeatureGuide, GlyphFeatureGuide, HeatmapFeatureGuide } from './context'
import type {
  FillPipeline,
  GlyphFilterPipeline,
  GlyphPipeline,
  HeatmapPipeline,
  LinePipeline,
  Pipeline,
  PointPipeline,
  RasterPipeline,
  SensorPipeline,
  ShadePipeline,
  SkyboxPipeline,
  WallpaperPipeline,
  Workflow,
  WorkflowImports,
  WorkflowKey,
  WorkflowType
} from './pipelines/pipeline.spec'
import type { GlyphImages } from 'workers/source/glyphSource'
import type { TileGPU as Tile } from 'source/tile.spec'
import type Projector from 'ui/camera/projector'
import type { PainterData } from 'workers/worker.spec'
import type TimeCache from 'ui/camera/timeCache'
// import type { FeatureGuide } source/tile'
// import type { PipelineType } from './pipelines/pipeline'

export default class Painter {
  context: WebGPUContext
  workflows: Workflow = {}
  dirty: boolean = false
  currPipeline?: WorkflowKey
  // currPipeline: PipelineType
  // dirty: boolean = true
  constructor (context: GPUCanvasContext, options: MapOptions) {
    this.context = new WebGPUContext(context, options)
  }

  buildFeatureData (tile: Tile, data: PainterData): void {
    const workflow = this.workflows[data.type] as { buildSource: (data: PainterData, tile: Tile) => void } | undefined
    workflow?.buildSource(data, tile)
  }

  async buildWorkflows (buildSet: Set<WorkflowType>): Promise<void> {
    const { workflows, context } = this
    const promises: Array<Promise<void>> = []
    const programCases: WorkflowImports = {
      fill: async () => { return await import('./pipelines/fillPipeline') }
      // raster: async () => {},
      // sensor: async () => {},
      // line: async () => {},
      // point: async () => {},
      // heatmap: async () => {},
      // shade: async () => {},
      // glyph: async () => {},
      // glyphFilter: async () => {},
      // wallpaper: async () => {},
      // skybox: async () => {}
    }
    const programKeys: Array<keyof Omit<Workflow, 'background'>> = []
    for (const program of buildSet) {
      if (program in workflows) continue
      if (program === 'glyph') programKeys.push('glyphFilter')
      programKeys.push(program)
    }
    // actually import the programs
    for (const key of programKeys) {
      promises.push(new Promise((resolve, reject) => {
        // @ts-expect-error - just ignore for now
        programCases[key]()
          // @ts-expect-error - just ignore for now
          .then(async ({ default: pModule }) => {
            workflows[key] = await pModule(context)
            if (key === 'wallpaper' || key === 'skybox') workflows.background = workflows[key]
            resolve()
          })
          .catch((err: any) => { reject(err) })
      }))
    }
    await Promise.allSettled(promises)
    if (workflows.glyphFilter !== undefined && workflows.glyph !== undefined) {
      // TODO:
      // const glyph = workflows.glyph
      // glyph.injectFilter(workflows.glyphFilter)
    }
  }

  resize (width: number, height: number): void {
  }

  getScreen (): Uint8ClampedArray {
    // const { gl } = this.context
    // const { canvas, RGBA, UNSIGNED_BYTE } = gl
    // const { width, height } = canvas
    // const pixels = new Uint8ClampedArray(width * height * 4)
    // gl.readPixels(0, 0, width, height, RGBA, UNSIGNED_BYTE, pixels)

    // return pixels
    return new Uint8ClampedArray()
  }

  injectGlyphImages (maxHeight: number, images: GlyphImages): void {
    // const { glyph } = this.workflows
    // glyph.injectImages(maxHeight, images)
  }

  setColorMode (mode: 0 | 1 | 2 | 3): void {
    this.dirty = true
    // tell all the workflows
    // const { workflows } = this
    // for (const programName in workflows) {
    //   const program = workflows[programName as WorkflowType] as Program
    //   program.updateColorBlindMode = mode
    // }
  }

  delete (): void {
    // const { context, pipelines } = this
    // for (const pipelineName in pipelines) pipelines[pipelineName].delete()
    // context.delete()
  }

  useWorkflow (programName: 'fill'): FillPipeline | undefined
  useWorkflow (programName: 'glyph'): GlyphPipeline | undefined
  useWorkflow (programName: 'heatmap'): HeatmapPipeline | undefined
  useWorkflow (programName: 'line'): LinePipeline | undefined
  useWorkflow (programName: 'point'): PointPipeline | undefined
  useWorkflow (programName: 'raster'): RasterPipeline | undefined
  useWorkflow (programName: 'sensor'): SensorPipeline | undefined
  useWorkflow (programName: 'shade'): ShadePipeline | undefined
  useWorkflow (programName: 'glyphFilter'): GlyphFilterPipeline | undefined
  useWorkflow (programName: 'background'): WallpaperPipeline | SkyboxPipeline | undefined
  useWorkflow (programName: WorkflowKey): Pipeline | undefined {
    const program = this.workflows[programName]
    if (program === undefined && programName !== 'background') throw new Error(`Program ${programName} not found`)
    if (this.currPipeline !== programName) {
      this.currPipeline = programName
      // program?.use()
    }
    return program
  }

  injectTimeCache (timeCache: TimeCache): void {
    this.workflows.sensor?.injectTimeCache(timeCache)
  }

  injectFrameUniforms (matrix: Float32Array, view: Float32Array, aspect: Float32Array): void {
  }

  // usePipeline (pipelineName: PipelineType): void | Pipeline {
  // }

  // resize () {
  //   // const { context } = this
  //   // // If we are using the text pipeline, update the text pipeline's framebuffer component's sizes
  //   // const glyphFilter: GlyphFilterPipeline = this.pipelines.glyphFilter
  //   // const heatmap: HeatmapPipeline = this.pipelines.heatmap
  //   // if (glyphFilter) glyphFilter.resize()
  //   // if (heatmap) heatmap.resize()
  //   // // ensure interaction buffer is accurate
  //   // context.resizeInteract()
  //   // // ensure our default viewport is accurate
  //   // context.resetViewport()
  //   // // notify that the painter is dirty
  //   // this.dirty = true
  // }

  paint (projector: Projector, tiles: Tile[]): void {
  }

  paintInteractive (tiles: Tile[]): void {
  }

  #createTileMasksIDs (tiles: Tile[]): void {
    let maskRef = 1
    // add all tiles
    for (const tile of tiles) {
      tile.tmpMaskID = maskRef
      maskRef++
    }
  }

  paintMasks (tiles: Tile[]): void {
  }

  paintFeatures (features: FeatureGuide[], interactive: boolean): void {
  }

  // // run through tiles and draw the masks, inject depthPos and
  // flushInvert (tiles: Array<Tile>, pipeline: Pipeline, depthPos: number) {
  // }

  paintHeatmap (features: HeatmapFeatureGuide[]): HeatmapFeatureGuide {
    return features[0]
  }

  paintGlyphFilter (glyphFeatures: GlyphFeatureGuide[]): void {}

  // getScreen (): Uint8ClampedArray {
  // }

  // _paintGlyphFilter (glyphFilterPipeline: GlyphFilterPipeline, glyphFeatures: Array<FeatureGuide>, mode: 1 | 2) {
  // }

  // injectGlyphImages (maxHeight: number, images: GlyphImages) {
  // }
}

// function featureSort (a: FeatureGuide, b: FeatureGuide): number {
//   let diff = a.layerIndex - b.layerIndex
//   if (diff) return diff
//   let index = 0
//   const zoomDiff = (a.parent ? 1 : 0) - (b.parent ? 1 : 0)
//   if (zoomDiff) return zoomDiff
//   const maxSize = Math.min(a.featureCode.length, b.featureCode.length)
//   while (diff === 0 && index < maxSize) {
//     diff = a.featureCode[index] - b.featureCode[index]
//     index++
//   }
//   return diff
// }
