import { WebGPUContext } from './context/index.js';
import {
  FillWorkflow,
  GlyphWorkflow,
  HeatmapWorkflow,
  HillshadeWorkflow,
  LineWorkflow,
  PointWorkflow,
  RasterWorkflow,
  ShadeWorkflow,
  SkyboxWorkflow,
  WallpaperWorkflow,
} from './workflows/index.js';

import type { ColorMode } from 's2/s2Map.js';
import type { GlyphImages } from 'workers/source/glyphSource.js';
import type { MapOptions } from 'ui/s2mapUI.js';
import type { Projector } from 'ui/camera/projector/index.js';
import type { TileGPU as Tile } from 'source/tile.spec.js';
import type TimeCache from 'ui/camera/timeCache.js';
import type {
  Features,
  GlyphFeature,
  HeatmapFeature,
  Workflow,
  WorkflowImports,
  WorkflowType,
  Workflows,
} from './workflows/workflow.spec.js';
import type { PainterData, SpriteImageMessage } from 'workers/worker.spec.js';

/**
 * # GPU Painter
 *
 * ## Description
 * The GPU painter is the main entry point to the GPU features.
 */
export default class Painter {
  context: WebGPUContext;
  workflows: Workflows = {};
  dirty = true;
  /**
   * @param context - the GPU context wrapper
   * @param options - map options to pull out the options that impact the painter and GPU
   */
  constructor(context: GPUCanvasContext, options: MapOptions) {
    this.context = new WebGPUContext(context, options, this);
  }

  /** called once to properly prepare the context */
  async prepare(): Promise<void> {
    await this.context.connectGPU();
  }

  /**
   * Given a tile, build the feature data associated with it
   * @param tile - the tile to inject the features into
   * @param data - the collection of data to sift through and build features
   */
  buildFeatureData(tile: Tile, data: PainterData): void {
    const workflow = this.workflows[data.type] as Workflow | undefined;
    workflow?.buildSource?.(data, tile);
  }

  /**
   * Build all workflows used by the style layers
   * @param buildSet - the set of workflows to build
   */
  async buildWorkflows(buildSet: Set<WorkflowType>): Promise<void> {
    const { workflows, context } = this;
    const workflowCases: WorkflowImports = {
      /** @returns a Fill Workflow */
      fill: () => new FillWorkflow(context),
      /** @returns a raster Workflow */
      raster: () => new RasterWorkflow(context),
      /** @returns a sensor Workflow (eventually) */
      sensor: () => new RasterWorkflow(context),
      /** @returns a line Workflow */
      line: () => new LineWorkflow(context),
      /** @returns a point Workflow */
      point: () => new PointWorkflow(context),
      /** @returns a heatmap Workflow */
      heatmap: () => new HeatmapWorkflow(context),
      /** @returns a hillshade Workflow */
      hillshade: () => new HillshadeWorkflow(context),
      /** @returns a shade Workflow */
      shade: () => new ShadeWorkflow(context),
      /** @returns a glyph Workflow */
      glyph: () => new GlyphWorkflow(context),
      /** @returns a wallpaper Workflow */
      wallpaper: () => new WallpaperWorkflow(context),
      /** @returns a skybox Workflow */
      skybox: () => new SkyboxWorkflow(context),
    };
    const promises: Array<Promise<void>> = [];
    for (const set of buildSet) {
      // @ts-expect-error - we know its a workflow
      const workflow = (workflows[set] = workflowCases[set]());
      if (set === 'wallpaper' || set === 'skybox') workflows.background = workflows[set];
      promises.push(workflow.setup());
    }
    await Promise.allSettled(promises);
  }

  /** @returns a Uint8ClampedArray screen capture */
  async getScreen(): Promise<Uint8ClampedArray> {
    return await this.context.getRenderData();
  }

  /**
   * Set the colorblind mode
   * @param mode - colorblind mode to set
   */
  setColorMode(mode: ColorMode): void {
    this.dirty = true;
    this.context.setColorBlindMode(mode);
  }

  /**
   * Inject a glyph image to the GPU
   * @param maxHeight - the maximum height of the texture
   * @param images - the glyph images
   * @param tiles - the tiles to update
   */
  injectGlyphImages(maxHeight: number, images: GlyphImages, tiles: Tile[]): void {
    const textureResized = this.context.injectImages(maxHeight, images);
    if (textureResized) {
      for (const feature of tiles.flatMap((tile) => tile.featureGuides))
        feature.updateSharedTexture?.();
    }
  }

  /**
   * Inject a sprite image to the GPU
   * @param data - the raw image data of the sprite
   * @param tiles - the tiles to update
   */
  injectSpriteImage(data: SpriteImageMessage, tiles: Tile[]): void {
    const textureResized = this.context.injectSpriteImage(data);
    if (textureResized) {
      for (const feature of tiles.flatMap((tile) => tile.featureGuides))
        feature.updateSharedTexture?.();
    }
  }

  /**
   * Inject a time cache for the sensor workflow
   * @param timeCache - the time cache to inject
   */
  injectTimeCache(timeCache: TimeCache): void {
    this.workflows.sensor?.injectTimeCache(timeCache);
  }

  /**
   * Resize the canvas
   * @param width - new width
   * @param height - new height
   */
  resize(width: number, height: number): void {
    this.context.resize((): void => {
      // If any workflows are using the resize method, call it
      for (const workflow of Object.values(this.workflows) as Workflow[])
        workflow.resize?.(width, height);
    });
    // notify that the painter is dirty
    this.dirty = true;
  }

  /**
   * Paint all the tiles in view
   * @param projector - the camera and what it currently sees
   * @param tiles - all the tiles in view to paint
   */
  paint(projector: Projector, tiles: Tile[]): void {
    const { context, workflows } = this;
    // setup for the next frame
    context.newScene(projector.view, projector.getMatrix('m'));
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

    // prep all tile's features to draw
    const features: Features[] = allFeatures.filter((f) => f.type !== 'heatmap');
    // draw heatmap data if applicable, and a singular feature for the main render thread to draw the texture to the screen
    const heatmapFeatures = allFeatures.filter((f): f is HeatmapFeature => f.type === 'heatmap');

    // compute heatmap data
    const heatmapFeature = workflows.heatmap?.textureDraw(heatmapFeatures);
    if (heatmapFeature !== undefined) features.push(...heatmapFeature);
    // sort features
    features.sort(featureSort);
    // prep glyph features for drawing box filters
    const glyphFeatures = features.filter((f): f is GlyphFeature => f.type === 'glyph');
    workflows.glyph?.computeFilters(glyphFeatures);

    // DRAW PHASE
    // draw masks
    for (const { mask } of tiles) mask.draw();
    // draw the wallpaper
    workflows.background?.draw(projector);
    // paint opaque fills
    const opaqueFillFeatures = features.filter((f) => f.layerGuide.opaque).reverse();
    for (const feature of opaqueFillFeatures) feature.draw();
    // paint features that are potentially transparent
    const residualFeatures = features.filter((f) => !(f.layerGuide.opaque ?? false));
    for (const feature of residualFeatures) feature.draw();

    // finish
    context.finish();
  }

  /**
   * Compute the interactive features in current view
   * @param tiles - current view tiles that we need to sift through for interactive features
   */
  computeInteractive(tiles: Tile[]): void {
    const interactiveFeatures = tiles
      .flatMap((tile) => tile.featureGuides)
      .filter(({ layerGuide }) => layerGuide.interactive)
      .sort(featureSort)
      .reverse();
    if (interactiveFeatures.length > 0) {
      // prepare & compute
      this.context.clearInteractBuffer();
      this.#computeInteractive(interactiveFeatures);
    }
  }

  /**
   * Compute the interactive features via the GPU
   * @param features - input features that need to be computed
   */
  #computeInteractive(features: Features[]): void {
    const { device, frameBufferBindGroup } = this.context;
    // prepare
    const commandEncoder = device.createCommandEncoder();
    const computePass = (this.context.computePass = commandEncoder.beginComputePass());
    computePass.setBindGroup(0, frameBufferBindGroup);
    // compute
    for (const feature of features) feature.compute?.();
    // finish
    computePass.end();
    device.queue.submit([commandEncoder.finish()]);
  }

  /** Delete the GPU instance */
  delete(): void {
    const { context, workflows } = this;
    for (const workflow of Object.values(workflows) as Workflow[]) workflow.destroy();
    context.destroy();
  }
}

/**
 * Sort the features
 * @param a - first feature
 * @param b - comparison feature
 * @returns a negative value if a < b, 0 if a === b, and a positive value if a > b
 */
function featureSort(a: Features, b: Features): number {
  // first check if the layer is the same
  let diff = a.layerGuide.layerIndex - b.layerGuide.layerIndex;
  if (diff !== 0) return diff;
  // check for zoom difference
  const zoomDiff = (a.parent !== undefined ? 1 : 0) - (b.parent !== undefined ? 1 : 0);
  if (zoomDiff !== 0) return zoomDiff;
  // lastlye try to sort by feature code
  let index = 0;
  const maxSize = Math.min(a.featureCode.length, b.featureCode.length);
  while (diff === 0 && index < maxSize) {
    diff = a.featureCode[index] - b.featureCode[index];
    index++;
  }
  return diff;
}
