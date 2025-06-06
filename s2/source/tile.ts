import { project } from 'ui/camera/projector/mat4.js';
import {
  bboxST,
  llToTilePx,
  pointFromSTGL,
  pointMulScalar,
  pointNormalize,
  pointSub,
} from 'gis-tools/index.js';

import type { DOMContext } from 's2/dom/context.js';
import type { Context as WebGLContext } from 'gl/context/index.js';
import type { WebGPUContext } from 'gpu/context/index.js';
import type { BBox, Face, S2CellId } from 'gis-tools/index.js';
import type {
  Corners,
  FaceST,
  SharedContext,
  SharedFeatures,
  SharedMaskSource,
  TileShared,
  TileBase as TileSpec,
} from './tile.spec.js';
import type {
  InteractiveObject,
  SourceFlushMessage,
  TileFlushMessage,
} from 'workers/worker.spec.js';
import type { LayerDefinition, Projection } from 'style/style.spec.js';
import type { Projector, TileInView, TmpWMID } from 'ui/camera/projector/index.js';

/**
 * Create a new Tile given the approprate projection, context and ID.
 * @param projection - the projection type (WM or S2)
 * @param context - the GPU or WebGL context
 * @param tileInfo - the tile identifier
 * @returns the new Tile object
 */
export function createTile(
  projection: Projection,
  context: WebGPUContext | WebGLContext | DOMContext,
  tileInfo: TileInView,
): TileShared {
  const Tile = projection === 'S2' ? S2Tile : WMTile;
  return new Tile(context as unknown as SharedContext, tileInfo) as unknown as TileShared;
}

/** Base Tile Class that all Tiles inherit from. */
class Tile<C extends SharedContext, F extends SharedFeatures, M extends SharedMaskSource>
  implements TileSpec<C, F, M>
{
  id: S2CellId;
  face: Face = 0;
  i = 0;
  j = 0;
  zoom = 0;
  division = 1;
  tmpMaskID = 0;
  mask!: M;
  bbox: BBox = [0, 0, 0, 0];
  readonly featureGuides: F[] = [];
  context: C;
  interactiveGuide = new Map<number, InteractiveObject>();
  uniforms = new Float32Array(7); // [isS2, face, zoom, sLow, tLow, deltaS, deltaT]
  bottomTop = new Float32Array(8);
  state: 'loading' | 'loaded' | 'deleted' = 'loading';
  type: 'S2' | 'WM' = 'S2';
  faceST!: FaceST;
  matrix!: Float32Array;
  layersLoaded = new Set<number>();
  layersToBeLoaded?: Set<number>;
  // WM only feature: if the tile is "out of bounds", it references a real world tile
  // by copying the parents featureGuides.
  wrappedID?: TmpWMID;
  dependents: Array<Tile<C, F, M>> = [];
  /**
   * @param context - the GPU or WebGL context
   * @param id - the tile ID
   */
  constructor(context: C, id: S2CellId) {
    this.context = context;
    this.id = id;
  }

  /**
   * inject references to featureGuide from each parentTile. Sometimes if we zoom really fast, we inject
   * a parents' parent or deeper, so we need to reflect that in the tile property.
   * @param parent - parent tile to inject
   * @param layers - the effected layers to modify
   */
  injectParentTile(parent: TileSpec<C, F, M>, layers: LayerDefinition[]): void {
    // feature guides
    for (const feature of parent.featureGuides) {
      if (feature.maskLayer ?? false) continue; // ignore mask features
      const { maxzoom } = layers[feature.layerGuide.layerIndex];
      const actualParent = feature.parent ?? parent;
      if (this.zoom <= maxzoom) {
        const bounds = this.#buildBounds(actualParent);
        // @ts-expect-error - we need fix this one day
        this.featureGuides.push(feature.duplicate(this, actualParent, bounds));
      }
    }
    // interactive guides
    for (const [id, interactive] of parent.interactiveGuide)
      this.interactiveGuide.set(id, interactive);
  }

  /**
   * inject references to featureGuide from a wrapped tile
   * @param wrapped - the wrapped tile
   */
  injectWrappedTile(wrapped: TileSpec<C, F, M>): void {
    // add existing features to the wrapped tile
    this.#addFeaturesToDependents(this, wrapped.featureGuides);
    // let the wrapped tile know that it has a dependent
    wrapped.dependents.push(this);
  }

  /**
   * set the screen positions of the mask
   * @param _ - the projector (not needed here)
   */
  setScreenPositions(_: Projector): void {
    const { context, mask, bottomTop } = this;
    // if WebGPU mask, we need to update the position buffer
    if (mask.positionBuffer !== undefined) {
      context.device?.queue.writeBuffer(mask.positionBuffer, 0, bottomTop);
    }
  }

  /**
   * get an interactive feature's properties if it exists
   * @param id - the id of the feature
   * @returns the interactive object
   */
  getInteractiveFeature(id: number): undefined | InteractiveObject {
    return this.interactiveGuide.get(id);
  }

  /**
   * add features to the tile
   * @param features - the features to add
   */
  addFeatures(features: F[]): void {
    const { featureGuides, layersLoaded } = this;
    // filter parent tiles that were added
    const layerIndexes = new Set<number>(features.map((f) => f.layerGuide.layerIndex));
    for (let i = featureGuides.length - 1; i >= 0; i--) {
      const feature = featureGuides[i];
      if (feature.parent !== undefined && layerIndexes.has(feature.layerGuide.layerIndex))
        featureGuides.splice(i, 1);
    }
    // add features
    this.featureGuides.push(...features);
    // clear from sourceCheck then check if all sources are loaded
    for (const layerIndex of layerIndexes) layersLoaded.add(layerIndex);

    // if this tile has dependents, we need to also add these features to those tiles
    for (const dependent of this.dependents) {
      this.#addFeaturesToDependents(dependent, features);
    }

    this.#checkState();
  }

  /**
   * Flush message that was sent from the Source or Tile Workers letting this tile know the source and layer's state
   * @param msg - input flush messge
   */
  flush(msg: SourceFlushMessage | TileFlushMessage): void {
    if (msg.from === 'source') this.#sourceFlush({ ...msg });
    else this.#tileFlush({ ...msg });
    for (const dependent of this.dependents) dependent.flush(msg);
    this.#checkState();
  }

  /** cleanup after itself. When a tile is deleted, it's adventageous to cleanup GPU cache. */
  delete(): void {
    this.state = 'deleted';
    // remove all features
    for (const feature of this.featureGuides) feature.destroy?.();
    // @ts-expect-error - we need to clear the array
    this.featureGuides = [];
    this.interactiveGuide = new Map();
    // TODO: WebGPU needs the data past it's lifetime...
    // IDEA: Copy the parent mask so that any data used is always isolated to the tile in question
    // this.mask.destroy?.()
  }

  /* STYLE CHANGES */

  /**
   * Delete a layer
   * @param index - the index of the layer
   */
  deleteLayer(index: number): void {
    const { featureGuides } = this;
    // remove any references to layerIndex
    for (let i = featureGuides.length - 1; i >= 0; i--) {
      const f = featureGuides[i];
      if (f.layerGuide.layerIndex === index) featureGuides.splice(i, 1);
    }
    // all layerIndexes greater than index should be decremented once
    for (const { layerGuide } of this.featureGuides) {
      if (layerGuide.layerIndex > index) layerGuide.layerIndex--;
    }
    for (const dependent of this.dependents) dependent.deleteLayer(index);
  }

  /**
   * Reorder layers
   * @param layerChanges - a map of layerIndex to new layerIndex
   */
  reorderLayers(layerChanges: Record<number, number>): void {
    for (const { layerGuide } of this.featureGuides) {
      const change = layerChanges[layerGuide.layerIndex];
      if (change !== undefined) layerGuide.layerIndex = change;
    }
    for (const dependent of this.dependents) dependent.reorderLayers(layerChanges);
  }

  /**
   * remove all sources that match the input sourceNames
   * @param sourceNames - the names of the sources
   */
  deleteSources(sourceNames: string[]): void {
    const { featureGuides } = this;
    for (let i = featureGuides.length - 1; i >= 0; i--) {
      const fg = featureGuides[i];
      const fgSourceName: string = fg.layerGuide.sourceName.split(':')[0];
      const keep = !sourceNames.includes(fgSourceName);
      if (!keep) {
        fg.destroy?.();
        featureGuides.splice(i, 1);
      }
    }
    for (const dependent of this.dependents) dependent.deleteSources(sourceNames);
  }

  /* DATA */

  /**
   * Inject interactive data. we don't parse the interactiveData immediately to save time
   * @param interactiveGuide - the interactive guide
   * @param interactiveData - the interactive data
   */
  injectInteractiveData(interactiveGuide: Uint32Array, interactiveData: Uint8Array): void {
    // setup variables
    let id: number, start: number, end: number;
    const textDecoder = new TextDecoder('utf-8');
    // build interactive guide
    for (let i = 0, gl = interactiveGuide.length; i < gl; i += 3) {
      id = interactiveGuide[i];
      start = interactiveGuide[i + 1];
      end = interactiveGuide[i + 2];
      // parse feature and add properties
      const interactiveObject: InteractiveObject = JSON.parse(
        textDecoder.decode(interactiveData.slice(start, end)),
      );
      this.interactiveGuide.set(id, interactiveObject);
    }
  }

  /* INTERNAL */

  /**
   * currently this is for glyphs, points, and heatmaps. By sharing glyph data with children,
   * the glyphs will be rendered 4 or even more times. To alleviate this, we can set boundaries
   * of what points will be considered
   * @param parent - the parent tile
   * @returns the bounds
   */
  #buildBounds(parent: TileSpec<C, F, M>): BBox {
    let { i, j, zoom } = this;
    const parentZoom = parent.zoom;
    // get the scale
    const scale = 1 << (zoom - parentZoom);
    // get i and j shift
    let iShift = 0;
    let jShift = 0;
    while (zoom > parentZoom) {
      const div = 1 << (zoom - parentZoom);
      if (i % 2 !== 0) iShift += 1 / div;
      if (j % 2 !== 0) jShift += 1 / div;
      // decrement
      i = i >> 1;
      j = j >> 1;
      zoom--;
    }

    // build the bounds bbox
    return [0 + iShift, 0 + jShift, 1 / scale + iShift, 1 / scale + jShift];
  }

  /** Checks the state of the layers. Updates the tiles state if all layers are loaded */
  #checkState(): void {
    const { layersLoaded, layersToBeLoaded } = this;
    if (this.state === 'deleted' || layersToBeLoaded === undefined) return;
    // if all layers are loaded, set state to loaded
    if (setBContainsA(layersToBeLoaded, layersLoaded)) this.state = 'loaded';
  }

  /**
   * Add features to list of dependents we need to update
   * @param dependent - the dependent
   * @param features - the features to add
   */
  #addFeaturesToDependents(dependent: Tile<C, F, M>, features: F[]): void {
    // @ts-expect-error - no reason this should be failing buit it is
    const dFeatures: F[] = features
      .filter((f) => f.parent === undefined)
      // @ts-expect-error - no reason this should be failing buit it is
      .map((f: F) => f.duplicate(dependent, f.parent, f.bounds));

    dependent.addFeatures(dFeatures);
  }

  /**
   * Flush the source data
   * @param msg - the message
   */
  #sourceFlush(msg: SourceFlushMessage): void {
    this.layersToBeLoaded = msg.layersToBeLoaded;
    for (const dependent of this.dependents) dependent.#sourceFlush(msg);
    this.#checkState();
  }

  /**
   * Flush the tile data
   * @param msg - the message
   */
  #tileFlush(msg: TileFlushMessage): void {
    const { featureGuides, layersLoaded } = this;
    const { deadLayers } = msg;
    // otherwise remove "left over" feature guide data from parent injection
    // or old data that wont be replaced in the future
    // NOTE: Eventually the count will be used to know what features need to be tracked (before screenshots for instance)
    for (let i = featureGuides.length - 1; i >= 0; i--) {
      const { layerGuide, parent } = featureGuides[i];
      if (
        deadLayers.includes(layerGuide.layerIndex) &&
        parent !== undefined &&
        // corner-case: empty data/missing tile -> flushes ALL layers,
        // but that layer MAY BE inverted so we don't kill it.
        !(('invert' in layerGuide && layerGuide.invert) ?? false)
      )
        featureGuides.splice(i, 1);
    }
    // remove dead layers from layersToBeLoaded
    for (const deadLayer of deadLayers) layersLoaded.add(deadLayer);
  }
}

/** S2 Geometry Projection Tile */
export class S2Tile<
  C extends SharedContext,
  F extends SharedFeatures,
  M extends SharedMaskSource,
> extends Tile<C, F, M> {
  override type = 'S2' as const;
  corners?: Corners;
  /**
   * @param context - the context to use (GPU or WebGL)
   * @param tileInfo - Information about the tile
   */
  constructor(context: C, tileInfo: TileInView) {
    const { id, face, zoom, x, y } = tileInfo;
    super(context, id);
    const { max, min, floor } = Math;
    this.face = face;
    this.i = x;
    this.j = y;
    const bbox = (this.bbox = bboxST(x, y, zoom));
    this.faceST = [face, zoom, bbox[2] - bbox[0], bbox[0], bbox[3] - bbox[1], bbox[1]];
    if (zoom >= 12) this.#buildCorners();
    // setup uniforms
    this.uniforms = new Float32Array([
      1, // isS2
      face,
      zoom,
      bbox[0], // sLow
      bbox[1], // tLow
      bbox[2] - bbox[0], // deltaS
      bbox[3] - bbox[1], // deltaT
    ]);
    // build division
    this.division = 16 / (1 << max(min(floor(zoom / 2), 4), 0));
    // grab mask
    this.mask = context.getMask(this.division, this as never) as M;
  }

  /** Build the corners for the tile. Luckily only needs to be built once */
  #buildCorners(): void {
    const { face, bbox } = this;

    this.corners = {
      topLeft: pointMulScalar(pointNormalize(pointFromSTGL(face, bbox[0], bbox[3])), 6371008.8),
      topRight: pointMulScalar(pointNormalize(pointFromSTGL(face, bbox[2], bbox[3])), 6371008.8),
      bottomLeft: pointMulScalar(pointNormalize(pointFromSTGL(face, bbox[0], bbox[1])), 6371008.8),
      bottomRight: pointMulScalar(pointNormalize(pointFromSTGL(face, bbox[2], bbox[1])), 6371008.8),
    };
  }

  /**
   * given a matrix, compute the corners screen positions
   * @param projector - the camera's current view
   */
  override setScreenPositions(projector: Projector): void {
    if (this.corners !== undefined) {
      const { eye } = projector;
      const eyeKM = pointMulScalar(eye, 1000);
      const matrix = projector.getMatrix('km');
      // pull out the S2Points
      const { bottomLeft, bottomRight, topLeft, topRight } = this.corners;
      // project points and grab their x-y positions
      const { x: blX, y: blY } = project(matrix, pointSub(bottomLeft, eyeKM));
      const { x: brX, y: brY } = project(matrix, pointSub(bottomRight, eyeKM));
      const { x: tlX, y: tlY } = project(matrix, pointSub(topLeft, eyeKM));
      const { x: trX, y: trY } = project(matrix, pointSub(topRight, eyeKM));
      // store for eventual uniform "upload"
      this.bottomTop[0] = blX;
      this.bottomTop[1] = blY;
      this.bottomTop[2] = brX;
      this.bottomTop[3] = brY;
      this.bottomTop[4] = tlX;
      this.bottomTop[5] = tlY;
      this.bottomTop[6] = trX;
      this.bottomTop[7] = trY;
      // if WebGPU mask, we need to update the position buffer
      super.setScreenPositions(projector);
    }
  }
}

/** Web Mercator Projection Tile */
export class WMTile<
  C extends SharedContext,
  F extends SharedFeatures,
  M extends SharedMaskSource,
> extends Tile<C, F, M> {
  override type = 'WM' as const;
  override matrix: Float32Array = new Float32Array(16);
  /**
   * @param context - a GPU context or WebGL context
   * @param tileInfo - Information about the tile
   */
  constructor(context: C, tileInfo: TileInView) {
    const { id, x, y, zoom, wrappedID } = tileInfo;
    super(context, id);
    this.i = x;
    this.j = y;
    this.zoom = zoom;
    this.wrappedID = wrappedID;
    // TODO: bboxWM? And do I apply it to the uniforms?
    // const bbox = this.bbox = bboxST(i, j, zoom)
    this.bbox = bboxST(x, y, zoom);
    // setup uniforms
    this.uniforms = new Float32Array([
      0, // isS2
      0, // face
      zoom, // zoom
      // padding (unused by WM tiles)
      0, // sLow
      0, // tLow
      1, // deltaS
      1, // deltaT
    ]);
    // grab mask
    this.mask = context.getMask(1, this as never) as M;
  }

  /**
   * given a basic ortho matrix, adjust by the tile's offset and scale
   * @param projector - the camera's current view
   */
  override setScreenPositions(projector: Projector): void {
    const { zoom, lon, lat } = projector;
    const scale = Math.pow(2, zoom - this.zoom);
    const offset = llToTilePx({ x: lon, y: lat }, [this.zoom, this.i, this.j], 1);

    this.matrix = projector.getMatrix(scale, offset);

    // build bottomTop
    const { matrix } = this;
    const bl = project(matrix, { x: 0, y: 0, z: 0 });
    const br = project(matrix, { x: 1, y: 0, z: 0 });
    const tl = project(matrix, { x: 0, y: 1, z: 0 });
    const tr = project(matrix, { x: 1, y: 1, z: 0 });
    // store for eventual uniform "upload"
    this.bottomTop[0] = bl.x;
    this.bottomTop[1] = bl.y;
    this.bottomTop[2] = br.x;
    this.bottomTop[3] = br.y;
    this.bottomTop[4] = tl.x;
    this.bottomTop[5] = tl.y;
    this.bottomTop[6] = tr.x;
    this.bottomTop[7] = tr.y;

    super.setScreenPositions(projector);
  }
}

/**
 * Check if setA is a subset of set2
 * @param setA - set to check
 * @param set2 - set to check against
 * @returns true if setA is a subset of set2
 */
function setBContainsA(setA: Set<number>, set2: Set<number>): boolean {
  // TODO: Remove this function to favor: setA.isSupersetOf(set2); (check it works live first)
  for (const item of setA) if (!set2.has(item)) return false;
  return true;
}
