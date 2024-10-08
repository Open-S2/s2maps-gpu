import type {
  WebGL2Context,
  WebGLContext
} from './context'
import type {
  WorkflowKey,
  WorkflowType,
  Workflows
} from './workflows/workflow.spec'
import type { TileGL as Tile } from 'source/tile.spec'
import type { PainterData, SpriteImageMessage } from 'workers/worker.spec'
import type { GlyphImages } from 'workers/source/glyphSource'
import type Projector from 'ui/camera/projector'
import type TimeCache from 'ui/camera/timeCache'
import type { Point } from 'geometry'

export interface Painter {
  context: WebGLContext | WebGL2Context
  workflows: Workflows
  dirty: boolean
  currWorkflow?: WorkflowKey

  prepare: () => Promise<void>

  buildFeatureData: (tile: Tile, data: PainterData) => void
  buildWorkflows: (buildSet: Set<WorkflowType>) => Promise<void>
  resize: (width: number, height: number) => void
  getScreen: () => Promise<Uint8ClampedArray>
  injectGlyphImages: (maxHeight: number, images: GlyphImages, tile: Tile[]) => void
  setColorMode: (mode: 0 | 1 | 2 | 3 | 4) => void
  delete: () => void
  injectFrameUniforms: (matrix: Float32Array, view: Float32Array, aspect: Point) => void
  injectSpriteImage: (data: SpriteImageMessage, tiles: Tile[]) => void
  injectTimeCache: (timeCache: TimeCache) => void
  paint: (projector: Projector, tiles: Tile[]) => void
  computeInteractive: (tiles: Tile[]) => void
}
