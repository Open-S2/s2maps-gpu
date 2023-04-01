import type {
  FeatureGuide,
  GlyphFeatureGuide,
  HeatmapFeatureGuide,
  WebGL2Context,
  WebGLContext
} from './contexts'
import type {
  FillProgram,
  GlyphFilterProgram,
  GlyphProgram,
  HeatmapProgram,
  LineProgram,
  PointProgram,
  RasterProgram,
  SensorProgram,
  ShadeProgram,
  SkyboxProgram,
  WallpaperProgram,
  Workflow,
  WorkflowKey,
  WorkflowType
} from './programs/program.spec'
import type { TileGL as Tile } from '../source/tile.spec'
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
import type { GlyphImages } from '../workers/source/glyphSource'
import type Projector from '../ui/camera/projector'
import type TimeCache from '../ui/camera/timeCache'

export interface Painter {
  context: WebGLContext | WebGL2Context
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
    ((tile: Tile, data: SensorData) => void) &
    ((tile: Tile, data: PainterData) => void)
  )
  useWorkflow: (
    ((programName: 'fill') => FillProgram | undefined) &
    ((programName: 'glyph') => GlyphProgram | undefined) &
    ((programName: 'heatmap') => HeatmapProgram | undefined) &
    ((programName: 'line') => LineProgram | undefined) &
    ((programName: 'point') => PointProgram | undefined) &
    ((programName: 'raster') => RasterProgram | undefined) &
    ((programName: 'sensor') => SensorProgram | undefined) &
    ((programName: 'shade') => ShadeProgram | undefined) &
    ((programName: 'glyphFilter') => GlyphFilterProgram | undefined) &
    ((programName: 'background') => WallpaperProgram | SkyboxProgram | undefined)
  )
  buildWorkflows: (buildSet: Set<WorkflowType>) => Promise<void>
  resize: (width: number, height: number) => void
  getScreen: () => Uint8ClampedArray
  injectGlyphImages: (maxHeight: number, images: GlyphImages) => void
  setColorMode: (mode: 0 | 1 | 2 | 3) => void
  delete: () => void
  injectFrameUniforms: (matrix: Float32Array, view: number[], aspect: number[]) => void
  injectTimeCache: (timeCache: TimeCache) => void
  paint: (projector: Projector, tiles: Tile[]) => void
  paintInteractive: (tiles: Tile[]) => void
  paintMasks: (tiles: Tile[]) => void
  paintFeatures: (features: FeatureGuide[], interactive: boolean) => void
  paintHeatmap: (features: HeatmapFeatureGuide[]) => HeatmapFeatureGuide
  paintGlyphFilter: (glyphFeatures: GlyphFeatureGuide[]) => void
}
