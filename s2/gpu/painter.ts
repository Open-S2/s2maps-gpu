// @ts-nocheck
/* eslint-env browser */
import { WebGPUContext } from './context'

import type { MapOptions } from '../ui/s2mapUI'
// import S2MapGL from '../ui/s2mapGL'
// import { StyleDefinition } from '../style/styleSpec'
import type { GlyphFilterPipeline, GlyphPipeline, HeatmapPipeline, LinePipeline, Pipeline, PointPipeline, RasterPipeline, SensorPipeline, ShadePipeline, SkyboxPipeline, WallpaperPipeline, Workflow, WorkflowKey, WorkflowType } from './pipelines/pipeline.spec'
import type { GlyphImages } from '../workers/source/glyphSource'
import type { TileGPU as Tile } from '../source/tile.spec'
import type Projector from '../ui/camera/projector'
import type {
  FillData,
  GlyphData,
  HeatmapData,
  LineData,
  PainterData,
  PointData,
  RasterData,
  SensorData
} from '../workers/worker.spec'
import FillPipeline from './pipelines/fillPipeline'
import type TimeCache from '../ui/camera/timeCache'
// import type { FeatureGuide } from '../source/tile'
// import type { PipelineType } from './pipelines/pipeline'

export default class Painter {
  context: WebGPUContext
  workflows: Workflow = {}
  dirty: boolean = false
  currProgram?: WorkflowKey
  // currPipeline: PipelineType
  // dirty: boolean = true
  constructor (context: GPUCanvasContext, options: MapOptions) {
    this.context = new WebGPUContext(context, options)
  }

  buildFeatureData (tile: Tile, data: FillData): void
  buildFeatureData (tile: Tile, data: GlyphData): void
  buildFeatureData (tile: Tile, data: HeatmapData): void
  buildFeatureData (tile: Tile, data: LineData): void
  buildFeatureData (tile: Tile, data: PointData): void
  buildFeatureData (tile: Tile, data: RasterData): void
  buildFeatureData (tile: Tile, data: SensorData): void
  buildFeatureData (tile: Tile, data: PainterData): void {
    // this.workflows[data.type]?.buildSource(data as any, tile)
  }

  async buildWorkflows (buildSet: Set<WorkflowType>): Promise<void> {
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
    if (this.currProgram !== programName) {
      this.currProgram = programName
      program?.use()
    } else { program?.flush() }
    return program
  }

  injectTimeCache (timeCache: TimeCache): void {
    this.workflows.sensor?.injectTimeCache(timeCache)
  }

  // buildPipelines (buildSet: Set<PipelineType>) {
  //   const { pipelines, context } = this
  //   for (const pipeline of buildSet) {
  //     switch (pipeline) {
  //       case 'raster':
  //         pipelines.raster = new RasterPipeline(context)
  //         break
  //       case 'fill':
  //         pipelines.fill = new FillPipeline(context)
  //         break
  //       case 'line':
  //         pipelines.line = new LinePipeline(context)
  //         break
  //       case 'point':
  //         pipelines.point = new PointPipeline(context)
  //         break
  //       case 'heatmap':
  //         pipelines.heatmap = new HeatmapPipeline(context)
  //         break
  //       case 'shade':
  //         pipelines.shade = new ShadePipeline(context)
  //         break
  //       case 'glyph':
  //         pipelines.glyphFilter = new GlyphFilterPipeline(context)
  //         pipelines.glyph = new GlyphPipeline(context, pipelines.glyphFilter)
  //         break
  //       case 'wallpaper':
  //         pipelines.wallpaper = new WallpaperPipeline(context)
  //         break
  //       case 'skybox':
  //         pipelines.skybox = new SkyboxPipeline(context)
  //         break
  //       default: break
  //     }
  //   }
  // }

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
