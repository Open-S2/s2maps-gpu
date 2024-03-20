import type {
  WebGL2Context,
  WebGLContext
} from './contexts'
import type {
  FeatureGuide,
  FillWorkflow,
  GlyphFeature,
  GlyphFilterWorkflow,
  GlyphWorkflow,
  HeatmapFeature,
  HeatmapWorkflow,
  HillshadeWorkflow,
  LineWorkflow,
  PointWorkflow,
  RasterWorkflow,
  SensorWorkflow,
  ShadeWorkflow,
  SkyboxWorkflow,
  WallpaperWorkflow,
  WorkflowKey,
  WorkflowType,
  Workflows
} from './workflows/workflow.spec'
import type { TileGL as Tile } from 'source/tile.spec'
import type { PainterData, SpriteImageMessage } from 'workers/worker.spec'
import type { GlyphImages } from 'workers/source/glyphSource'
import type Projector from 'ui/camera/projector'
import type TimeCache from 'ui/camera/timeCache'

export interface Painter {
  context: WebGLContext | WebGL2Context
  workflows: Workflows
  dirty: boolean
  currWorkflow?: WorkflowKey

  prepare: () => Promise<void>

  buildFeatureData: (tile: Tile, data: PainterData) => void
  useWorkflow: (
    ((workflowName: 'fill') => FillWorkflow) &
    ((workflowName: 'glyph') => GlyphWorkflow | undefined) &
    ((workflowName: 'heatmap') => HeatmapWorkflow | undefined) &
    ((workflowName: 'line') => LineWorkflow | undefined) &
    ((workflowName: 'point') => PointWorkflow | undefined) &
    ((workflowName: 'raster') => RasterWorkflow | undefined) &
    ((workflowName: 'hillshade') => HillshadeWorkflow | undefined) &
    ((workflowName: 'sensor') => SensorWorkflow | undefined) &
    ((workflowName: 'shade') => ShadeWorkflow | undefined) &
    ((workflowName: 'glyphFilter') => GlyphFilterWorkflow | undefined) &
    ((workflowName: 'background') => WallpaperWorkflow | SkyboxWorkflow | undefined)
  )
  buildWorkflows: (buildSet: Set<WorkflowType>) => Promise<void>
  resize: (width: number, height: number) => void
  getScreen: () => Promise<Uint8ClampedArray>
  injectGlyphImages: (maxHeight: number, images: GlyphImages, tile: Tile[]) => void
  setColorMode: (mode: 0 | 1 | 2 | 3 | 4) => void
  delete: () => void
  injectFrameUniforms: (matrix: Float32Array, view: Float32Array, aspect: [number, number]) => void
  injectSpriteImage: (data: SpriteImageMessage, tiles: Tile[]) => boolean
  injectTimeCache: (timeCache: TimeCache) => void
  paint: (projector: Projector, tiles: Tile[]) => void
  computeInteractive: (tiles: Tile[]) => void
  paintMasks: (tiles: Tile[]) => void
  paintFeatures: (features: FeatureGuide[], interactive: boolean) => void
  paintHeatmap: (features: HeatmapFeature[]) => HeatmapFeature
  paintGlyphFilter: (glyphFeatures: GlyphFeature[]) => void
}
