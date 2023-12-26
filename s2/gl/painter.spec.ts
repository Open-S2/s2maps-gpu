import type {
  FeatureGuide,
  GlyphFeatureGuide,
  HeatmapFeatureGuide
} from './contexts/context.spec'
import type {
  WebGL2Context,
  WebGLContext
} from './contexts'
import type {
  FillProgram,
  GlyphFilterProgram,
  GlyphProgram,
  HeatmapProgram,
  HillshadeProgram,
  LineProgram,
  PointProgram,
  Program,
  RasterProgram,
  SensorProgram,
  ShadeProgram,
  SkyboxProgram,
  WallpaperProgram,
  Workflow,
  WorkflowKey,
  WorkflowType
} from './programs/program.spec'
import type { TileGL as Tile } from 'source/tile.spec'
import type { PainterData } from 'workers/worker.spec'
import type { GlyphImages } from 'workers/source/glyphSource'
import type Projector from 'ui/camera/projector'
import type TimeCache from 'ui/camera/timeCache'

export interface Painter {
  context: WebGLContext | WebGL2Context
  workflows: Workflow
  dirty: boolean
  currProgram?: WorkflowKey

  buildFeatureData: (tile: Tile, data: PainterData) => void
  useWorkflow: (
    ((programName: 'fill') => FillProgram) |
    ((programName: 'glyph') => GlyphProgram | undefined) |
    ((programName: 'heatmap') => HeatmapProgram | undefined) |
    ((programName: 'line') => LineProgram | undefined) |
    ((programName: 'point') => PointProgram | undefined) |
    ((programName: 'raster') => RasterProgram | undefined) |
    ((programName: 'hillshade') => HillshadeProgram | undefined) |
    ((programName: 'sensor') => SensorProgram | undefined) |
    ((programName: 'shade') => ShadeProgram | undefined) |
    ((programName: 'glyphFilter') => GlyphFilterProgram | undefined) |
    ((programName: 'background') => WallpaperProgram | SkyboxProgram | undefined) |
    ((programName: WorkflowKey) => Program | undefined)
  )
  buildWorkflows: (buildSet: Set<WorkflowType>) => Promise<void>
  resize: (width: number, height: number) => void
  getScreen: () => Uint8ClampedArray
  injectGlyphImages: (maxHeight: number, images: GlyphImages) => void
  setColorMode: (mode: 0 | 1 | 2 | 3 | 4) => void
  delete: () => void
  injectFrameUniforms: (matrix: Float32Array, view: Float32Array, aspect: [number, number]) => void
  injectTimeCache: (timeCache: TimeCache) => void
  paint: (projector: Projector, tiles: Tile[]) => void
  computeInteractive: (tiles: Tile[]) => void
  paintMasks: (tiles: Tile[]) => void
  paintFeatures: (features: FeatureGuide[], interactive: boolean) => void
  paintHeatmap: (features: HeatmapFeatureGuide[]) => HeatmapFeatureGuide
  paintGlyphFilter: (glyphFeatures: GlyphFeatureGuide[]) => void
}
