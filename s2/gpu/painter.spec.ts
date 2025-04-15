import type { ColorMode } from 's2/s2Map';
import type { GlyphImages } from 'workers/source/glyphSource';
import type Projector from 'ui/camera/projector';
import type { TileGPU as Tile } from 'source/tile.spec';
import type TimeCache from 'ui/camera/timeCache';
import type { WebGPUContext } from './context';
import type { PainterData, SpriteImageMessage } from 'workers/worker.spec';
import type { WorkflowKey, WorkflowType, Workflows } from './workflows/workflow.spec';

/**
 * WebGPU Painter interface
 */
export interface Painter {
  context: WebGPUContext;
  workflows: Workflows;
  dirty: boolean;
  currWorkflow?: WorkflowKey;

  prepare: () => Promise<void>;

  buildFeatureData: (tile: Tile, data: PainterData) => void;
  buildWorkflows: (buildSet: Set<WorkflowType>) => Promise<void>;
  resize: (width: number, height: number) => void;
  getScreen: () => Promise<Uint8ClampedArray>;
  injectGlyphImages: (maxHeight: number, images: GlyphImages, tiles: Tile[]) => void;
  injectSpriteImage: (data: SpriteImageMessage, tiles: Tile[]) => void;
  injectTimeCache: (timeCache: TimeCache) => void;
  setColorMode: (mode: ColorMode) => void;
  delete: () => void;
  paint: (projector: Projector, tiles: Tile[]) => void;
  computeInteractive: (tiles: Tile[]) => void;
}
