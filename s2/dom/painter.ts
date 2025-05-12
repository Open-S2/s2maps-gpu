import { DOMContext } from './context.js';
import { RasterWorkflow } from './workflows/index.js';

import type { ColorMode } from 's2/s2Map.js';
import type { GlyphImages } from 's2/workers/source/glyphSource.js';
import type { MapOptions } from 'ui/s2mapUI.js';
import type { Painter as PainterSpec } from './painter.spec.js';
import type { Projector } from 'ui/camera/projector/index.js';
import type { TileDOM as Tile } from 'source/tile.spec.js';
import type TimeCache from 's2/ui/camera/timeCache.js';
import type { VectorPoint } from 's2/gis-tools/index.js';
import type { PainterData, SpriteImageMessage } from 'workers/worker.spec.js';
import type { Workflow, WorkflowKey, WorkflowType, Workflows } from './workflows/index.js';

/**
 * # DOM Painter
 *
 * ## Description
 * A painter for DOM contexts
 */
export default class Painter implements PainterSpec {
  context: DOMContext;
  workflows: Workflows = {};
  curWorkflow?: WorkflowKey;
  dirty = true;
  /**
   * @param canvas - DOM html element to render to
   * @param options - map options to pull out the options that impact the painter and GPU
   */
  constructor(canvas: HTMLCanvasElement, options: MapOptions) {
    this.context = new DOMContext(canvas, options, this);
  }

  /** called once to properly prepare the context */
  async prepare(): Promise<void> {}

  /**
   * Given a tile, build the feature data associated with it
   * @param tile - the tile to inject the features into
   * @param data - the collection of data to sift through and build features
   */
  buildFeatureData(tile: Tile, data: PainterData): void {
    if (data.type !== 'raster') return;
    const workflow = this.workflows[data.type];
    workflow?.buildSource(data, tile);
  }

  /**
   * Build all workflows used by the style layers
   * @param _buildSet - the set of workflows to build
   */
  async buildWorkflows(_buildSet: Set<WorkflowType>): Promise<void> {
    const { workflows, context } = this;
    workflows.raster = await new RasterWorkflow(context);
  }

  /**
   * Inject frame uniforms. WebGL requires uniforms to be update before each draw
   * @param matrix - the projection matrix
   * @param view - the view matrix
   * @param aspect - the canvas aspect ratio
   */
  injectFrameUniforms(matrix: Float32Array, view: Float32Array, aspect: VectorPoint): void {
    const { workflows } = this;
    for (const workflowName in workflows) {
      workflows[workflowName as keyof Workflows]?.injectFrameUniforms(matrix, view, aspect);
    }
  }

  /**
   * Inject a time cache for the sensor workflow
   * @param _timeCache - the time cache to inject
   */
  injectTimeCache(_timeCache: TimeCache): void {
    // this.workflows.sensor?.injectTimeCache(timeCache);
  }

  /**
   * Resize the canvas
   * @param _width - new width
   * @param _height - new height
   */
  resize(_width: number, _height: number): void {
    const { context } = this;
    // // If we are using the text workflow, update the text workflow's framebuffer component's sizes
    // const glyphFilter = this.workflows.glyphFilter;
    // const heatmap = this.workflows.heatmap;
    // if (glyphFilter !== undefined) glyphFilter.resize();
    // if (heatmap !== undefined) heatmap.resize();
    // ensure interaction buffer is accurate
    context.resize();
    // ensure our default viewport is accurate
    context.resetViewport();
    // notify that the painter is dirty
    this.dirty = true;
  }

  /**
   * Paint all the tiles in view
   * @param projector - the camera and what it currently sees
   * @param tiles - all the tiles in view to paint
   */
  paint(projector: Projector, tiles: Tile[]): void {
    const { context } = this;
    // reset the current workflow as undefined to ensure a new flush happens
    context.resetWorkflow();
    // prep frame uniforms
    const { view, aspect } = projector;
    const matrix = projector.getMatrix('m');
    this.injectFrameUniforms(matrix, view, aspect);
    // prep mask id's
    tiles.forEach((tile, index) => {
      tile.tmpMaskID = index + 1;
    });

    const allFeatures = tiles.flatMap((tile) => tile.featureGuides);
    // Mercator: the tile needs to update it's matrix at all zooms.
    // S2: all features tiles past zoom 12 must set screen positions
    let featureTiles = allFeatures.flatMap(({ parent, tile }) =>
      parent !== undefined ? [parent, tile] : [tile],
    );
    // remove all duplicates of tiles by their id
    featureTiles = featureTiles.filter(
      (tile, index) => featureTiles.findIndex((t) => t.id === tile.id) === index,
    );
    for (const tile of featureTiles) tile.setScreenPositions(projector);

    // // prep all tile's features to draw
    // const features: Features[] = allFeatures.filter((f) => f.type !== 'heatmap');
    // // draw heatmap data if applicable, and a singular feature for the main render thread to draw the texture to the screen
    // const heatmapFeatures = allFeatures.filter((f): f is HeatmapFeature => f.type === 'heatmap');
    // // compute heatmap data
    // const hfs = workflows.heatmap?.textureDraw(heatmapFeatures);
    // if (hfs !== undefined) features.push(...hfs);
    // // sort features
    // features.sort(featureSort);
    // // prep glyph features for drawing box filters
    // const glyphFeatures = features.filter((f): f is GlyphFeature => f.type === 'glyph');
    // workflows.glyph?.computeFilters(glyphFeatures);

    // // DRAW PHASE
    // // setup for the next frame
    // context.newScene();
    // // paint opaque fills
    // const opaqueFillFeatures = features.filter((f) => f.layerGuide.opaque).reverse();
    // for (const feature of opaqueFillFeatures) feature.draw();
    // // paint features that are potentially transparent
    // const residualFeatures = features.filter((f) => !(f.layerGuide.opaque ?? false));
    // for (const feature of residualFeatures) feature.draw();

    // finish
    context.finish();
  }

  /**
   * Compute the interactive features in current view
   * @param _tiles - current view tiles that we need to sift through for interactive features
   */
  computeInteractive(_tiles: Tile[]): void {
    // const interactiveFeatures = tiles
    //   .flatMap((tile) => tile.featureGuides)
    //   .filter((feature) => feature.layerGuide.interactive)
    //   .sort(featureSort)
    //   .reverse();
    // if (interactiveFeatures.length > 0) {
    //   // prepare & compute
    //   this.context.clearInteractBuffer();
    //   for (const f of interactiveFeatures) f.draw(true);
    // }
  }

  /** @returns a Uint8ClampedArray of the current screen */
  async getScreen(): Promise<Uint8ClampedArray> {
    return await new Uint8ClampedArray(0);
    // const { gl } = this.context;
    // const { canvas, RGBA, UNSIGNED_BYTE } = gl;
    // const { width, height } = canvas;
    // const pixels = new Uint8ClampedArray(width * height * 4);
    // gl.readPixels(0, 0, width, height, RGBA, UNSIGNED_BYTE, pixels);
    // return await pixels;
  }

  /**
   * Inject a glyph image to the GPU
   * @param maxHeight - the maximum height of the texture
   * @param images - the glyph images
   */
  injectGlyphImages(maxHeight: number, images: GlyphImages): void {
    this.context.injectImages(maxHeight, images);
  }

  /**
   * Inject a sprite image to the GPU
   * @param data - the raw image data of the sprite
   */
  injectSpriteImage(data: SpriteImageMessage): void {
    this.context.injectSpriteImage(data);
  }

  /**
   * Set the colorblind mode
   * @param mode - colorblind mode to set
   */
  setColorMode(mode: ColorMode): void {
    this.dirty = true;
    // tell all the workflows
    const { workflows } = this;
    for (const workflowName in workflows) {
      const workflow = workflows[workflowName as WorkflowKey] as unknown as Workflow;
      workflow.updateColorBlindMode = mode;
    }
  }

  /** Delete the GPU and painter instance */
  delete(): void {
    const { context, workflows } = this;
    for (const workflow of Object.values(workflows)) workflow.delete();
    context.delete();
  }
}

// /**
//  * Sort the features
//  * @param a - first feature
//  * @param b - comparison feature
//  * @returns a negative value if a < b, 0 if a === b, and a positive value if a > b
//  */
// function featureSort(a: Features, b: Features): number {
//   // first check if the layer is the same
//   let diff = a.layerGuide.layerIndex - b.layerGuide.layerIndex;
//   if (diff !== 0) return diff;
//   // check for zoom difference
//   const zoomDiff = (a.parent !== undefined ? 1 : 0) - (b.parent !== undefined ? 1 : 0);
//   if (zoomDiff !== 0) return zoomDiff;
//   // lastlye try to sort by feature code
//   let index = 0;
//   const maxSize = Math.min(a.featureCode.length, b.featureCode.length);
//   while (diff === 0 && index < maxSize) {
//     diff = a.featureCode[index] - b.featureCode[index];
//     index++;
//   }
//   return diff;
// }
