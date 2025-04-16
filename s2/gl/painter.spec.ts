import type { ColorMode } from 's2/s2Map.js';
import type { GlyphImages } from 'workers/source/glyphSource.js';
import type Projector from 'ui/camera/projector/index.js';
import type { TileGL as Tile } from 'source/tile.spec.js';
import type TimeCache from 'ui/camera/timeCache.js';
import type { VectorPoint } from 'gis-tools/index.js';
import type { PainterData, SpriteImageMessage } from 'workers/worker.spec.js';
import type { WebGL2Context, WebGLContext } from './context/index.js';
import type { WorkflowKey, WorkflowType, Workflows } from './workflows/workflow.spec.js';

/** A generic painter interface. */
export interface Painter {
  context: WebGLContext | WebGL2Context;
  workflows: Workflows;
  dirty: boolean;
  currWorkflow?: WorkflowKey;

  prepare: () => Promise<void>;

  buildFeatureData: (tile: Tile, data: PainterData) => void;
  buildWorkflows: (buildSet: Set<WorkflowType>) => Promise<void>;
  resize: (width: number, height: number) => void;
  getScreen: () => Promise<Uint8ClampedArray>;
  injectGlyphImages: (maxHeight: number, images: GlyphImages, tile: Tile[]) => void;
  setColorMode: (mode: ColorMode) => void;
  delete: () => void;
  injectFrameUniforms: (matrix: Float32Array, view: Float32Array, aspect: VectorPoint) => void;
  injectSpriteImage: (data: SpriteImageMessage, tiles: Tile[]) => void;
  injectTimeCache: (timeCache: TimeCache) => void;
  paint: (projector: Projector, tiles: Tile[]) => void;
  computeInteractive: (tiles: Tile[]) => void;
}
