import type {
  WebGPUContext
} from './context'
import type {
  // FeatureBase,
  WorkflowKey,
  WorkflowType,
  Workflows
  // GlyphFeatureBase,
  // HeatmapFeatureBase,
} from './workflows/workflow.spec'
import type { TileGPU as Tile } from 'source/tile.spec'
import type {
  // FillData,
  // GlyphData,
  // HeatmapData,
  // LineData,
  PainterData,
  SpriteImageMessage
  // PointData,
  // RasterData,
  // SensorData
} from 'workers/worker.spec'
import type { GlyphImages } from 'workers/source/glyphSource'
import type Projector from 'ui/camera/projector'

export interface Painter {
  context: WebGPUContext
  workflows: Workflows
  dirty: boolean
  currProgram?: WorkflowKey

  prepare: () => Promise<void>

  buildFeatureData: (tile: Tile, data: PainterData) => void
  buildWorkflows: (buildSet: Set<WorkflowType>) => Promise<void>
  resize: (width: number, height: number) => void
  getScreen: () => Uint8ClampedArray
  injectGlyphImages: (maxHeight: number, images: GlyphImages, tiles: Tile[]) => void
  injectSpriteImage: (data: SpriteImageMessage, tiles: Tile[]) => void
  setColorMode: (mode: 0 | 1 | 2 | 3 | 4) => void
  delete: () => void
  paint: (projector: Projector, tiles: Tile[]) => void
  computeInteractive: (tiles: Tile[]) => void
}
