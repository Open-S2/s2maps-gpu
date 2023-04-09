// @ts-nocheck
import type { WebGPUContext } from './context'
import type { FillPipeline, GlyphFilterPipeline, GlyphPipeline, HeatmapPipeline, LinePipeline, PointPipeline, RasterPipeline, SensorPipeline, ShadePipeline, SkyboxPipeline, WallpaperPipeline, Workflow, WorkflowKey, WorkflowType } from './pipelines/pipeline.spec'
import type { TileGPU as Tile } from 's2/source/tile.spec'
import type { FillData, GlyphData, HeatmapData, LineData, PointData, RasterData, SensorData } from 's2/util/worker.spec'
import type { GlyphImages } from 's2/util/source/glyphSource'
import type Projector from 's2/ui/camera/projector'

export interface Painter {
  context: WebGPUContext
  workflows: Workflow
  dirty: boolean
  currProgram?: WorkflowKey

  buildFeatureData: (
    ((tile: Tile, data: FillData) => void) &
    ((tile: Tile, data: GlyphData) => void) &
    ((tile: Tile, data: HeatmapData) => void) &
    ((tile: Tile, data: LineData) => void) &
    ((tile: Tile, data: PointData) => void) &
    ((tile: Tile, data: RasterData) => void) &
    ((tile: Tile, data: SensorData) => void)
  )
  useWorkflow: (
    ((programName: 'fill') => FillPipeline | undefined) &
    ((programName: 'glyph') => GlyphPipeline | undefined) &
    ((programName: 'heatmap') => HeatmapPipeline | undefined) &
    ((programName: 'line') => LinePipeline | undefined) &
    ((programName: 'point') => PointPipeline | undefined) &
    ((programName: 'raster') => RasterPipeline | undefined) &
    ((programName: 'sensor') => SensorPipeline | undefined) &
    ((programName: 'shade') => ShadePipeline | undefined) &
    ((programName: 'glyphFilter') => GlyphFilterPipeline | undefined) &
    ((programName: 'background') => WallpaperPipeline | SkyboxPipeline | undefined)
  )
  buildWorkflows: (buildSet: Set<WorkflowType>) => Promise<void>
  resize: (width: number, height: number) => void
  getScreen: () => Uint8ClampedArray
  injectGlyphImages: (maxHeight: number, images: GlyphImages) => void
  setColorMode: (mode: 0 | 1 | 2 | 3) => void
  delete: () => void
  injectFrameUniforms: (matrix: Float32Array, view: Float32Array, aspect: Float32Array) => void
  paint: (projector: Projector, tiles: Tile[]) => void
  paintInteractive: (tiles: Tile[]) => void
  paintMasks: (tiles: Tile[]) => void
  paintFeatures: (features: FeatureGuide[], interactive: boolean) => void
  paintHeatmap: (features: HeatmapFeatureGuide[]) => HeatmapFeatureGuide
  paintGlyphFilter: (glyphFeatures: GlyphFeatureGuide[]) => void
}
