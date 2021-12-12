// @flow
/* eslint-env browser */
// import Style from '../style'
// /** CONTEXTS **/
// import Context from './context'
// /** PROGRAMS **/
// // import {
// //   Pipeline,
// //   FillPipeline,
// //   GlyphFilterPipeline,
// //   GlyphPipeline,
// //   HeatmapPipeline,
// //   LinePipeline,
// //   PointPipeline,
// //   RasterPipeline,
// //   ShadePipeline,
// //   SkyboxPipeline,
// //   WallpaperPipeline
// // } from './pipelines'
// /** SOURCES **/
// import { Tile } from '../source'

// import type { MapOptions } from '../ui/map'
// import type Projector from '../ui/camera/projector'
// import type { FeatureGuide } from '../source/tile'
// import type { PipelineType } from './pipelines/pipeline'

export default class Painter {
  // context: Context
  // pipelines: { [string]: Pipeline } = {}
  // currPipeline: PipelineType
  // dirty: boolean = true

  // async createContext (context: WebGPUContext, options: MapOptions) {
  //   this.context = new Context(context, options)
  //   await this.context.connectGPU()
  // }

  // delete () {
  //   const { context, pipelines } = this
  //   for (const pipelineName in pipelines) pipelines[pipelineName].delete()
  //   context.delete()
  // }

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

  // injectFrameUniforms (matrix: Float32Array, view: Float32Array, aspect: Float32Array) {
  // }

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

  // paint (projector: Projector, style: Style, tiles: Array<Tile>) {
  // }

  // paintInteractive (tiles: Array<Tile>) {
  // }

  // _createTileMasksIDs (tiles: Array<Tile>) {
  // }

  // paintMasks (tiles: Array<Tile>) {
  // }

  // paintFeatures (features: Array<FeatureGuide>, interactive: boolean, tiles: Array<Tile>) {
  // }

  // // run through tiles and draw the masks, inject depthPos and
  // flushInvert (tiles: Array<Tile>, pipeline: Pipeline, depthPos: number) {
  // }

  // paintHeatmap (features: Array<FeatureGuide>) {
  // }

  // paintGlyphFilter (glyphFeatures: Array<FeatureGuide>) {
  // }

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
