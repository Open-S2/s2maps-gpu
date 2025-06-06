import type Camera from 'ui/camera/index.js';
import type { WorkflowType as GLWorkflowType } from 'gl/workflows/workflow.spec.js';
import type { WorkflowType as GPUWorkflowType } from 'gpu/workflows/workflow.spec.js';
import type { MapOptions } from 'ui/s2mapUI.js';
import type { TileShared as Tile } from 'source/tile.spec.js';
import type { UrlMap } from 's2/index.js';
import type {
  Analytics,
  FillDefinition,
  LayerDefinition,
  LayerDefinitionBase,
  LayerStyle,
  ShadeDefinition,
  StyleDefinition,
  StylePackage,
} from './style.spec.js';
import type { RequestStyleMessage, TileRequest } from 'workers/worker.spec.js';

/**
 * # Style Engine
 *
 * The Style Engine is responsible for:
 * - PRE) If style is a string (url), ship it off to Source Worker to fetch the style
 * - 1) Build workflows necessary to render the style
 * - 2) Build out the layers
 * - 3) Ship off appropriate style params to Tile Workers so they know how to build the tiles
 * - 4) Build the layers for the painter
 */
export default class Style {
  camera: Camera;
  apiKey?: string;
  urlMap?: UrlMap;
  maskLayers: Array<FillDefinition | ShadeDefinition> = [];
  layers: LayerDefinition[] = [];
  interactive = false;
  dirty = true;
  /**
   * @param camera - render camera
   * @param options - map options
   */
  constructor(camera: Camera, options: MapOptions) {
    const { apiKey, urlMap } = options;
    this.camera = camera;
    this.apiKey = apiKey;
    this.urlMap = urlMap;
  }

  /**
   * Build the style, preparing it for rendering and tile/source processing
   * @param style - style definition
   * @param ignorePosition - if true, we want to leave the position of the camera unchanged.
   * @returns true if we can start rendering
   */
  async buildStyle(style: string | StyleDefinition, ignorePosition = false): Promise<boolean> {
    const { camera } = this;
    const { painter, projector } = camera;
    if (typeof style === 'string') {
      this.#requestStyle(style);
      return false;
    }
    if (typeof style !== 'object') throw Error('style must be an object');
    this.dirty = true;
    // inform the projection
    painter.context.setProjection(style.projection ?? 'S2');
    // set the clear color if present
    if (style.clearColor !== undefined) {
      painter.context.setClearColor(style.clearColor);
    }
    // build workflows that don't exist yet (depends on projection)
    await this.#buildWorkflows(style);
    // build layer definitions
    this.#buildLayers(style.layers);
    // built layers let us know if we have an interactive layer or not (depends on layers)
    painter.context.setInteractive(this.interactive);
    // build time series if exists
    if (style.timeSeries !== undefined) camera.buildTimeCache(style.timeSeries);
    // ship to Tile Workers
    this.#sendStyleDataToWorkers(style);
    // update the projector with our style
    projector.setStyleParameters(style, ignorePosition);
    // return we can start rendering
    return true;
  }

  /**
   * Inject mask layers
   * @param tile - tile to inject the mask layers for
   */
  injectMaskLayers(tile: Tile): void {
    const { maskLayers, camera } = this;
    for (const maskLayer of maskLayers) {
      const workflow = camera.painter.workflows[maskLayer.type];
      workflow?.buildMaskFeature(maskLayer as never, tile);
    }
  }

  /**
   * Request the style if the input style was an href pointing to the style object
   * @param style - style href
   */
  #requestStyle(style: string): void {
    const { apiKey, urlMap, camera } = this;
    const { id, webworker } = camera;
    const analytics = this.#buildAnalytics();

    if (webworker) {
      const message: RequestStyleMessage = {
        mapID: id,
        analytics,
        type: 'requestStyle',
        style,
        apiKey,
        urlMap,
      };
      postMessage(message);
    } else {
      window.S2WorkerPool.requestStyle(id, style, analytics, apiKey, urlMap);
    }
  }

  /**
   * Build workflows
   * @param style - input style object
   */
  async #buildWorkflows(style: StyleDefinition): Promise<void> {
    const { camera, urlMap } = this;
    const { painter } = camera;
    const { skybox, wallpaper, layers } = style;
    const workflows = new Set<GLWorkflowType | GPUWorkflowType>(['fill']);
    // setup appropriate background if it exists
    if (skybox !== undefined) workflows.add('skybox');
    if (wallpaper !== undefined) workflows.add('wallpaper');
    // iterate layers and add workflows
    if (Array.isArray(layers)) {
      for (const layer of layers) {
        if (layer.type !== undefined) workflows.add(layer.type);
      }
    }
    // build workflows
    await painter.buildWorkflows(workflows);
    // inject styles into workflows
    for (const [name, workflow] of Object.entries(painter.workflows)) {
      if (name === 'background') continue;
      if ('updateStyle' in workflow) workflow.updateStyle(style, camera, urlMap);
    }
  }

  /**
   * Build layer definitions
   * - 1) ensure "bad" layers are removed (missing important keys or subkeys)
   * - 2) ensure the order is correct for when WebGL eventually parses the encodings
   * @param layers - layers to build
   */
  #buildLayers(layers: LayerStyle[] = []): void {
    const layerDefinitions: LayerDefinition[] = [];
    let layerIndex = 0;
    for (const layerStyle of layers) {
      const layerDefinition = this.#buildLayer(layerStyle, layerIndex);
      if (layerDefinition !== undefined) {
        if (
          layerDefinition.source === 'mask' &&
          (layerDefinition.type === 'fill' || layerDefinition.type === 'shade')
        )
          this.maskLayers.push(layerDefinition);
        layerDefinitions.push(layerDefinition);
        if (layerDefinition.interactive === true) this.interactive = true;
        layerIndex++;
      }
    }
    this.layers = layerDefinitions;
  }

  /**
   * Build layer definition
   * @param layerStyle - layer style to build
   * @param layerIndex - position of the layer in the style layers array
   * @returns a layer definition if successful
   */
  #buildLayer(layerStyle: LayerStyle, layerIndex: number): undefined | LayerDefinition {
    const { workflows } = this.camera.painter;
    // grab variables
    const { type, name, source, layer, minzoom, maxzoom, filter, lch, visible } = layerStyle;
    if (type === undefined || name === undefined || source === undefined) {
      console.warn(
        'Skipping layer: "',
        layerStyle,
        '" because it is missing "type", "name" and/or "source"',
      );
      return;
    }
    // prepare layer base
    const base: LayerDefinitionBase = {
      type,
      name,
      source,
      layerIndex,
      layer: layer ?? 'default',
      minzoom: minzoom ?? 0,
      maxzoom: maxzoom ?? 20,
      filter,
      lch: lch ?? false,
      visible: visible ?? true,
    };
    // store the layer definition
    const layerDefinition = workflows[type]?.buildLayerDefinition?.(base, layerStyle as never);
    if (layerDefinition !== undefined) return layerDefinition;
  }

  /**
   * Request tiles. The projector will forward requests throug this class so it can build the
   * tile requests with style specific data before forwarding it to the worker pool
   * @param tiles - tiles to request data for
   */
  requestTiles(tiles: Tile[]): void {
    if (tiles.length === 0) return;
    const { id, webworker } = this.camera;
    const tileRequests: TileRequest[] = [];
    tiles.forEach((tile) => {
      // grab request values
      const { id, face, i, j, zoom, type, bbox, division } = tile;
      // build tileRequests
      tileRequests.push({ id, face, i, j, zoom, type, bbox, division });
    });
    // send the tiles over to the worker pool manager to split the workload
    if (webworker) {
      postMessage({ mapID: id, type: 'tilerequest', tiles: tileRequests });
    } else {
      window.S2WorkerPool.tileRequest(id, tileRequests);
    }
  }

  /**
   * Send style data to workers
   * @param style - style definition to forward
   */
  #sendStyleDataToWorkers(style: StyleDefinition): void {
    const { apiKey, urlMap, layers } = this;
    const { id, webworker, painter, projector } = this.camera;
    const { type } = painter.context;
    const { tileSize } = projector;
    const {
      projection,
      sources,
      glyphs,
      fonts,
      icons,
      sprites,
      images,
      minzoom,
      maxzoom,
      experimental,
    } = style;
    const analytics = this.#buildAnalytics();
    // now that we have various source data, package up the style objects we need and send it off:
    const stylePackage: StylePackage = {
      projection: projection ?? 'S2',
      gpuType: type,
      sources: sources ?? {},
      glyphs: glyphs ?? {},
      fonts: fonts ?? {},
      icons: icons ?? {},
      sprites: sprites ?? {},
      images: images ?? {},
      layers: layers.filter((l) => l.source !== 'mask'),
      minzoom: minzoom ?? 0,
      maxzoom: maxzoom ?? 20,
      tileSize,
      analytics,
      apiKey,
      urlMap,
      experimental: experimental ?? false,
    };
    // If the map engine is running on the main thread, directly send the stylePackage to the worker pool.
    // Otherwise perhaps this map instance is a web worker and has a global instance of postMessage
    if (webworker) {
      postMessage({ mapID: id, type: 'style', style: stylePackage });
    } else {
      window.S2WorkerPool.injectStyle(id, stylePackage);
    }
  }

  /**
   * This is a helper function to build the analytics object. Useful for servers to know what kind
   * of GPU or limitations this browser has
   * @returns the analytics object
   */
  #buildAnalytics(): Analytics {
    const { context } = this.camera.painter;
    const { renderer, type, presentation } = context;
    const { width, height } = presentation;
    return {
      gpu: renderer,
      context: type,
      language: navigator.language.split('-')[0] ?? 'en',
      width,
      height,
    };
  }
}

// addLayer (layer: Layer, nameIndex?: number | string, tileRequests: Array<TileRequest>) {
//   const { painter } = this.map
//   const workflows = new Set()
//   // prebuild & convert nameIndex to index
//   const index = this.#findLayerIndex(nameIndex)
//   this._prebuildLayer(layer, index)
//   // let the workers know
//   if (this.webworker) {
//     postMessage({ mapID: this.map.id, type: 'addLayer', layer, index, tileRequests })
//   } else {
//     window.S2WorkerPool.addLayer(this.map.id, layer, index, tileRequests)
//   }
//   // insert layer into layers, updating positions of other layers as necessary
//   const { layers } = this
//   layers.splice(index, 0, layer)
//   for (let i = index + 1, ll = layers.length; i < ll; i++) {
//     const layer = layers[i]
//     layer.layerIndex++
//     layer.depthPos++
//   }
//   // build layer
//   this._buildLayer(layer, index + 1, workflows)
//   // tell the painter that we might be using a new workflow
//   painter.buildWorkflows(workflows)
//   // let the renderer know the style is dirty
//   this.dirty = true
// }

// deleteLayer (nameIndex?: number | string): number {
//   // grab the index
//   const index = this.#findLayerIndex(nameIndex)
//   // let the workers know
//   if (this.webworker) {
//     postMessage({ mapID: this.map.id, type: 'deleteLayer', index })
//   } else {
//     window.S2WorkerPool.deleteLayer(this.map.id, index)
//   }
//   // remove index from layers and update layerIndex & depthPos
//   const { layers } = this
//   layers.splice(index, 1)
//   for (let i = index, ll = layers.length; i < ll; i++) {
//     const layer = layers[i]
//     layer.layerIndex--
//     layer.depthPos--
//   }
//   // let the renderer know the style is dirty
//   this.dirty = true

//   return index
// }

// reorderLayers (layerChanges: { [string | number]: number }) {
//   const { layers } = this
//   const newLayers = []
//   // move the layer to its new position
//   for (const [from, to] of Object.entries(layerChanges)) {
//     const layer = layers[+from]
//     layer.layerIndex = to
//     layer.depthPos = to + 1
//     newLayers[to] = layer
//   }
//   // store the new layers
//   this.layers = newLayers
//   // let the webworkers know about the reorder
//   if (this.webworker) {
//     postMessage({ mapID: this.map.id, type: 'reorderLayers', layerChanges })
//   } else {
//     window.S2WorkerPool.reorderLayers(this.map.id, layerChanges)
//   }
//   // let the renderer know the style is dirty
//   this.dirty = true
// }

// export function findLayerIndex (layers: LayerDefinition[], nameIndex: number | string): number {
//   const length = layers.length
//   if (typeof nameIndex === 'number') {
//     return nameIndex
//   } else if (typeof nameIndex === 'string') {
//     for (let i = 0; i < length; i++) {
//       const layer = layers[i]
//       if (layer.name === nameIndex) {
//         return i
//       }
//     }
//   }

//   return length
// }
