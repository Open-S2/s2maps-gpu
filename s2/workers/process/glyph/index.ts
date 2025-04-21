import CollisionTester from './collisionTester.js';
import coalesceField from 'style/coalesceField.js';
import featureSort from '../util/featureSort.js';
import parseFeature from 's2/style/parseFeature.js';
import parseFilter from 'style/parseFilter.js';
import { DEFAULT_OPTIONS_WITHOUT_BIDI_SHAPING, shapeString } from 'unicode-shaper';
import {
  QUAD_SIZE_PATH,
  QUAD_SIZE_TEXT,
  buildGlyphPathQuads,
  buildGlyphPointQuads,
} from './buildGlyphQuads.js';
import VectorWorker, { colorFunc, idToRGB } from '../vectorWorker.js';
import {
  getCenterPoints,
  getPointsAndPathsAlongLines,
  getPointsAndPathsAtCenterOfLines,
  getSpacedPoints,
  scaleShiftClip,
} from '../util/index.js';

import type { CodeDesign } from '../vectorWorker.js';
import type ImageStore from '../imageStore.js';
import type {
  Alignment,
  Anchor,
  GPUType,
  GlyphDefinition,
  GlyphWorkerLayer,
  Placement,
} from 'style/style.spec.js';
import type { GlyphBase, GlyphObject, GlyphPath, GlyphPoint } from './glyph.spec.js';
import type { GlyphData, TileRequest } from 'workers/worker.spec.js';
import type {
  GlyphFeature,
  GlyphWorker as GlyphWorkerSpec,
  IDGen,
  VTFeature,
} from '../process.spec.js';
import type { Point, VectorMultiPoint } from 'gis-tools/index.js';

/** Worker for processing glyph data */
export default class GlyphWorker extends VectorWorker implements GlyphWorkerSpec {
  collisionTest: CollisionTester = new CollisionTester();
  imageStore: ImageStore;
  featureStore = new Map<string, GlyphObject[]>(); // tileID -> features
  sourceWorker: MessagePort;
  tileSize: number;
  /**
   * @param idGen - id generator to ensure features don't overlap
   * @param gpuType - the GPU context of the map renderer (WebGL(1|2) | WebGPU)
   * @param sourceWorker - the source worker to send requests to
   * @param imageStore - the image store to pull/request the needed glyphs/icons
   * @param tileSize - the tile size
   */
  constructor(
    idGen: IDGen,
    gpuType: GPUType,
    sourceWorker: MessagePort,
    imageStore: ImageStore,
    tileSize: number,
  ) {
    super(idGen, gpuType);
    this.sourceWorker = sourceWorker;
    this.imageStore = imageStore;
    this.tileSize = tileSize;
  }

  /**
   * Setup a glyph layer for future processing of vector data
   * @param glyphLayer - the glyph layer
   * @returns the layer to process future glyph data
   */
  setupLayer(glyphLayer: GlyphDefinition): GlyphWorkerLayer {
    const {
      name,
      layerIndex,
      source,
      layer,
      minzoom,
      maxzoom,
      filter,
      interactive,
      cursor,
      lch,
      overdraw,
      geoFilter,
      noShaping,
      // paint
      textSize,
      textFill,
      textStroke,
      textStrokeWidth,
      iconSize,
      // layout
      placement,
      spacing,
      textFamily,
      textField,
      textAnchor,
      textOffset,
      textPadding,
      textWordWrap,
      textAlign,
      textKerning,
      textLineHeight,
      iconFamily,
      iconField,
      iconAnchor,
      iconOffset,
      iconPadding,
    } = glyphLayer;

    // build featureCode designs
    const textDesign: CodeDesign = [
      [textSize],
      [textFill, colorFunc(lch)],
      [textStrokeWidth],
      [textStroke, colorFunc(lch)],
    ];
    const iconDesign: CodeDesign = [[iconSize]];

    const glyphWorkerLayer: GlyphWorkerLayer = {
      type: 'glyph',
      name,
      layerIndex,
      source,
      layer,
      minzoom,
      maxzoom,
      filter: parseFilter(filter),
      textGetCode: this.buildCode(textDesign),
      iconGetCode: this.buildCode(iconDesign),
      // paint
      textSize: parseFeature<number>(textSize),
      iconSize: parseFeature<number>(iconSize),
      // layout
      placement: parseFeature<Placement>(placement),
      spacing: parseFeature<number>(spacing),
      textFamily: parseFeature<string | string[]>(textFamily),
      textField: parseFeature<string | string[]>(textField),
      textAnchor: parseFeature<Anchor>(textAnchor),
      textOffset: parseFeature<Point>(textOffset),
      textPadding: parseFeature<Point>(textPadding),
      textWordWrap: parseFeature<number>(textWordWrap),
      textAlign: parseFeature<Alignment>(textAlign),
      textKerning: parseFeature<number>(textKerning),
      textLineHeight: parseFeature<number>(textLineHeight),
      iconFamily: parseFeature<string | string[]>(iconFamily),
      iconField: parseFeature<string | string[]>(iconField),
      iconAnchor: parseFeature<Anchor>(iconAnchor),
      iconOffset: parseFeature<Point>(iconOffset),
      iconPadding: parseFeature<Point>(iconPadding),
      // properties
      geoFilter,
      interactive,
      noShaping,
      cursor,
      overdraw,
    };

    return glyphWorkerLayer;
  }

  /**
   * Build a Glyph Feature from input vector data
   * @param tile - the tile request
   * @param extent - the extent of the tile
   * @param feature - the input vector tile feature
   * @param glyphLayer - the glyph worker layer describing how to process the feature
   * @param mapID - the id of the map to ship the data back to
   * @param sourceName - the name of the source the data belongs to
   * @returns true if the feature was built
   */
  async buildFeature(
    tile: TileRequest,
    extent: number,
    feature: VTFeature,
    glyphLayer: GlyphWorkerLayer,
    mapID: string,
    sourceName: string,
  ): Promise<boolean> {
    const { idGen, tileSize } = this;
    const { zoom } = tile;
    const { layerIndex, overdraw, interactive, geoFilter, noShaping } = glyphLayer;
    const { gpuType, imageStore, featureStore } = this;
    const { properties } = feature;
    let featureType = feature.geoType();
    const pointType = featureType === 'Point' || featureType === 'MultiPoint';
    const storeID: string = `${mapID}:${String(tile.id)}:${sourceName}`;
    if (!featureStore.has(storeID)) featureStore.set(storeID, []);
    // ensure that our imageStore is ready
    await imageStore.getReady(mapID);
    // filter as necessary
    if (geoFilter.includes('poly') && (featureType === 'Polygon' || featureType === 'MultiPolygon'))
      return false;
    if (
      geoFilter.includes('line') &&
      (featureType === 'LineString' || featureType === 'MultiLineString')
    )
      return false;
    if (geoFilter.includes('point') && pointType) return false;
    // load geometry
    let geometry = feature.loadPoints();
    if (geometry === undefined) return false;
    // get the placement, spacing, and orientation
    let placement = glyphLayer.placement([], properties, zoom);
    const spacing = (glyphLayer.spacing([], properties, zoom) / tileSize) * extent;
    // if we are placing along a line, but the geometry is a point, we skip
    if (pointType && placement !== 'point') placement = 'point';
    // if geometry is a line or poly, we may need to flatten it depending upon the placement
    if (!pointType && placement !== 'line' && placement !== 'line-center-path') {
      if (placement === 'point') geometry = getSpacedPoints(geometry, featureType, spacing, extent);
      else if (placement === 'line-center-point') geometry = getCenterPoints(geometry, featureType);
      featureType = 'Point';
    }
    // preprocess geometry
    const clip = scaleShiftClip(geometry, 4, extent, tile) as VectorMultiPoint;
    if (clip.length === 0) return false;

    // build out all the individual s,t tile positions from the feature geometry
    const glyphs: GlyphBase[] = [];
    for (const type of ['icon', 'text'] as Array<'icon' | 'text'>) {
      // icon FIRST incase text draws over the icon
      // build all layout and paint parameters
      // per tile properties
      const deadCode: number[] = [];
      let field = coalesceField(glyphLayer[`${type}Field`](deadCode, properties, zoom), properties);
      // pre-process and shape the unicodes
      if (field.length === 0) continue;
      let fieldCodes: string[] = [];
      const color: number[] = [];
      const familyProcess = glyphLayer[`${type}Family`](deadCode, properties, zoom);
      const family = Array.isArray(familyProcess) ? familyProcess : [familyProcess];
      // if icon, convert field to list of codes, otherwise create a unicode array
      let missing = false;
      if (type === 'text') {
        field = decodeHtmlEntities(field);
        try {
          field = shapeString(field, noShaping ? DEFAULT_OPTIONS_WITHOUT_BIDI_SHAPING : undefined);
        } catch (err) {
          console.error(
            field,
            field.split('').map((c) => c.charCodeAt(0)),
            err,
          );
        }
        fieldCodes = field
          .split('')
          .map((char) => char.charCodeAt(0))
          .map(String);
        imageStore.parseLigatures(mapID, family, fieldCodes);
      } else {
        fieldCodes = this.#mapIcon(mapID, family, field, color);
      }
      missing ||= imageStore.addMissingGlyph(mapID, tile.id, fieldCodes, family);
      // for rtree tests
      const size = glyphLayer[`${type}Size`](deadCode, properties, zoom);

      // grab codes
      const [gl1Code, gl2Code] = glyphLayer[`${type}GetCode`](zoom, properties);

      // prep glyph object
      const glyphBase: GlyphBase = {
        // organization parameters
        id: 0,
        idRGB: [0, 0, 0, 0],
        type,
        overdraw,
        layerIndex,
        gl2Code,
        code: gpuType === 1 ? gl1Code : gl2Code,
        // layout
        family,
        field,
        fieldCodes,
        spacing,
        offset: glyphLayer[`${type}Offset`](deadCode, properties, zoom),
        padding: glyphLayer[`${type}Padding`](deadCode, properties, zoom),
        kerning: type === 'text' ? glyphLayer.textKerning(deadCode, properties, zoom) : 0,
        lineHeight: type === 'text' ? glyphLayer.textLineHeight(deadCode, properties, zoom) : 0,
        anchor: glyphLayer[`${type}Anchor`](deadCode, properties, zoom) as Anchor,
        wordWrap: type === 'text' ? glyphLayer.textWordWrap(deadCode, properties, zoom) : 0,
        align: type === 'text' ? glyphLayer.textAlign(deadCode, properties, zoom) : 'center',
        // paint
        size,
        // prep color, quads
        color,
        quads: [],
        // track if this feature is missing char or icon data
        missing,
      };
      glyphs.push(glyphBase);
    }

    if (glyphs.length === 0) return false;

    // prep id tracker and store
    const ids: number[] = [];
    const store = featureStore.get(storeID);
    if (pointType) {
      for (const point of clip as VectorMultiPoint) {
        const id = idGen.getNum();
        const idRGB = idToRGB(id);
        ids.push(id);
        for (const glyphBase of glyphs) {
          const glyph: GlyphPoint = {
            ...glyphBase,
            id,
            idRGB,
            glyphType: 'point',
            quads: [],
            // tile position
            s: point.x / extent,
            t: point.y / extent,
            filter: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            // node proeprties
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
          };
          store?.push(glyph);
        }
      }
    } else {
      const pathDataList =
        placement === 'line-center-path'
          ? getPointsAndPathsAtCenterOfLines(geometry, featureType, extent)
          : getPointsAndPathsAlongLines(geometry, featureType, spacing, extent);
      for (const pathData of pathDataList) {
        const id = idGen.getNum();
        const idRGB = idToRGB(id);
        ids.push(id);
        for (const glyphBase of glyphs) {
          // path type
          const glyph: GlyphPath = {
            ...glyphBase,
            id,
            idRGB,
            glyphType: 'path',
            quads: [],
            // store geometry data and type to properly build later
            extent,
            pathData,
            // ensure wordWrap is 0
            wordWrap: 0,
            // setup filters
            filters: [],
            // node Properties
            nodes: [],
          };
          store?.push(glyph);
        }
      }
    }

    // if interactive, store interactive properties
    if (interactive) {
      for (const id of ids) this._addInteractiveFeature(id, properties, glyphLayer);
    }
    return true;
  }

  /**
   * Flush a tile-request to the render thread
   * @param mapID - id of the map to ship the data back to
   * @param tile - tile request
   * @param sourceName - name of the source the data belongs to
   * @param wait - wait function. We need to wait for a response of missing glyph/icon data beore flushing
   */
  override async flush(
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    wait: Promise<void>,
  ): Promise<void> {
    const storeID: string = `${mapID}:${String(tile.id)}:${sourceName}`;
    const features = this.featureStore.get(storeID) ?? [];
    // check if we need to wait for a response of missing data
    const missing = features.some((f) => f.missing);
    if (missing) await wait;
    // if no missing data just flush now
    this.#flushReadyFeatures(mapID, tile, sourceName, features);
    // finish the flush
    await super.flush(mapID, tile, sourceName, wait);
    // cleanup
    this.featureStore.delete(storeID);
  }

  /**
   * We hit this function after flush's await is resolved.
   * actually flushing because the glyph response came back (if needed)
   * and all glyphs are ready to be processed
   * @param mapID - id of the map to ship the data back to
   * @param tile - tile request
   * @param sourceName - name of the source the data belongs to
   * @param features - glyph features to ship
   */
  #flushReadyFeatures(
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    features: GlyphFeature[],
  ): void {
    const { imageStore, collisionTest, tileSize } = this;
    const storeID: string = `${mapID}:${String(tile.id)}:${sourceName}`;
    // prepare
    collisionTest.clear();
    const res: GlyphObject[] = [];
    // remove empty features; sort the features before running the collisions
    features = features.filter((feature) => {
      if (feature.type === 'icon') return true;
      // corner case: sometimes the feature field could just be a group of empty codes
      for (const code of feature.fieldCodes) {
        const num = Number(code);
        if (!isNaN(num) && num >= 33) return true;
      }
      return false;
    });
    features = features.sort(featureSort);
    for (const feature of features) {
      // Step 1: prebuild the glyph positions and bbox
      const glyphMap = imageStore.getGlyphSource(mapID);
      if (feature.glyphType === 'point') buildGlyphPointQuads(feature, glyphMap, tileSize);
      else buildGlyphPathQuads(feature, glyphMap, tileSize);
      // Step 2: check the collisionTest if we want to pre filter
      if (feature.quads.length !== 0 && (feature.overdraw || !collisionTest.collides(feature)))
        res.push(feature);
    }
    // replace the features with the filtered set
    this.featureStore.set(storeID, res);
    // Step 3: flush the features
    this.#flush(mapID, sourceName, tile.id);
  }

  /**
   * Build the glyph codes and colors for an icon
   * @param mapID - id of the map
   * @param family - icon family
   * @param field - icon field
   * @param outColor - output color
   * @returns glyph codes for the icon
   */
  #mapIcon(mapID: string, family: string[], field: string, outColor: number[]): string[] {
    const fieldCodes: string[] = [];
    const fam = Array.isArray(family) ? family[0] : family;
    const { iconCache } = this.imageStore.getFamilyMap(mapID, fam);
    const icon = iconCache.get(field);
    if (icon !== undefined) {
      for (const { glyphID, color } of icon) {
        fieldCodes.push(glyphID);
        outColor.push(...color);
      }
    }
    return fieldCodes;
  }

  /**
   * Flush the features
   * @param mapID - id of the map
   * @param sourceName - name of the source
   * @param tileID - tile id
   */
  #flush(mapID: string, sourceName: string, tileID: bigint): void {
    const storeID: string = `${mapID}:${tileID}:${sourceName}`;
    const features = this.featureStore.get(storeID) ?? [];
    if (features.length === 0) return;
    if (this.gpuType === 3) {
      this.#flushPoints3(mapID, sourceName, tileID, features);
    } else this.#flushPoints2(mapID, sourceName, tileID, features);
    // cleanup
    this.featureStore.delete(storeID);
  }

  /**
   * WebGL 1 & 2 Flushing
   * @param mapID - id of the map to ship the data back to
   * @param sourceName - name of the source the data belongs to
   * @param tileID - tile id the data belongs to
   * @param features - features to ship
   */
  #flushPoints2(mapID: string, sourceName: string, tileID: bigint, features: GlyphObject[]): void {
    // setup draw thread variables
    const glyphFilterData: number[] = [];
    const glyphFilterIDs: number[] = [];
    const glyphQuads: number[] = [];
    const glyphQuadIDs: number[] = [];
    const glyphColors: number[] = [];
    const featureGuide: number[] = [];
    // run through features and store
    let curlayerIndex = features[0].layerIndex;
    const curGlyphType = features[0].glyphType;
    let curType = features[0].type;
    let encoding: number[] = features[0].code;
    let codeStr: string = features[0].code.toString();
    let filterOffset = 0;
    let quadOffset = 0;
    let filterCount = 0;
    let quadCount = 0;
    let indexPos = 0;
    // iterate features, store as we go
    for (const feature of features) {
      if (feature.glyphType !== 'point') continue;
      const { idRGB, type, layerIndex, code, color, quads, filter } = feature;
      // if there is a change in layer index or not the same feature set
      if (
        (quadCount > 0 || filterCount > 0) &&
        (curlayerIndex !== layerIndex || codeStr !== code.toString() || curType !== type)
      ) {
        // store featureGuide
        featureGuide.push(
          curlayerIndex,
          ~~(curGlyphType === 'path'),
          ~~(curType === 'icon'),
          filterOffset,
          filterCount,
          quadOffset,
          quadCount,
          encoding.length,
          ...encoding,
        );
        // update to new codes
        curlayerIndex = layerIndex;
        codeStr = code.toString();
        curType = type;
        encoding = code;
        // update offests
        filterOffset += filterCount;
        quadOffset += quadCount;
        // reset counts
        filterCount = 0;
        quadCount = 0;
        indexPos = 0;
      }
      // store the quads and colors
      glyphFilterData.push(...filter, indexPos++);
      glyphFilterIDs.push(...idRGB);
      filterCount++;
      glyphQuads.push(...quads);
      const quadSize = curGlyphType === 'point' ? QUAD_SIZE_TEXT : QUAD_SIZE_PATH;
      const qCount = quads.length / quadSize;
      quadCount += qCount;
      // add the feature's id for each quad
      for (let i = 0; i < qCount; i++) glyphQuadIDs.push(...idRGB);
      // add color data
      if (color.length > 0) glyphColors.push(...feature.color);
      else for (let i = 0; i < qCount; i++) glyphColors.push(255, 255, 255, 255);
    }
    // store last set
    if (quadCount > 0 || filterCount > 0) {
      featureGuide.push(
        curlayerIndex,
        ~~(curGlyphType === 'path'),
        ~~(curType === 'icon'),
        filterOffset,
        filterCount,
        quadOffset,
        quadCount,
        encoding.length,
        ...encoding,
      );
    }

    // filter data
    const glyphFilterBuffer = new Float32Array(glyphFilterData).buffer;
    const glyphFilterIDBuffer = new Uint8ClampedArray(glyphFilterIDs).buffer;
    // quad draw data
    const glyphQuadBuffer = new Float32Array(glyphQuads).buffer;
    const glyphQuadIDBuffer = new Uint8ClampedArray(glyphQuadIDs).buffer;
    const glyphColorBuffer = new Uint8ClampedArray(glyphColors).buffer;
    const featureGuideBuffer = new Float32Array(featureGuide).buffer;

    const message: GlyphData = {
      mapID,
      type: 'glyph',
      sourceName,
      tileID,
      glyphFilterBuffer,
      glyphFilterIDBuffer,
      glyphQuadBuffer,
      glyphQuadIDBuffer,
      glyphColorBuffer,
      featureGuideBuffer,
    };
    // ship the data
    postMessage(message, [
      glyphFilterBuffer,
      glyphFilterIDBuffer,
      glyphQuadBuffer,
      glyphQuadIDBuffer,
      glyphColorBuffer,
      featureGuideBuffer,
    ]);
  }

  /**
   * WebGPU glyph data to be flushed / sent to the front-end
   * @param mapID - map id to ship the data back to
   * @param sourceName - name of the source the data belongs to
   * @param tileID - tile id the data belongs to
   * @param features - collection of glyph features to flush into the renderer
   */
  #flushPoints3(mapID: string, sourceName: string, tileID: bigint, features: GlyphObject[]): void {
    // ID => { index: resultIndex, count: how many share the same resultIndex }
    let currIndex = 0;
    const resultIndexMap = new Map<number, number>();
    for (const { id } of features) {
      if (!resultIndexMap.has(id)) resultIndexMap.set(id, currIndex++);
    }

    // setup draw thread variables
    const glyphFilterData: number[] = [];
    const glyphQuads: number[] = [];
    const glyphQuadIDs: number[] = [];
    const glyphColors: number[] = [];
    const featureGuide: number[] = [];
    // run through features and store
    let curlayerIndex = features[0].layerIndex;
    let curType = features[0].type;
    let curGlyphType = features[0].glyphType;
    let encoding: number[] = features[0].code;
    let codeStr: string = features[0].code.toString();
    let filterOffset = 0;
    let quadOffset = 0;
    let filterCount = 0;
    let quadCount = 0;
    // iterate features, store as we go
    for (const feature of features) {
      const { id, glyphType, type, layerIndex, code, color, quads } = feature;
      // if there is a change in layer index or
      if (
        (quadCount > 0 || filterCount > 0) &&
        (curlayerIndex !== layerIndex ||
          codeStr !== code.toString() ||
          curGlyphType !== glyphType ||
          curType !== type)
      ) {
        // store featureGuide
        featureGuide.push(
          curlayerIndex,
          ~~(curGlyphType === 'path'),
          ~~(curType === 'icon'),
          filterOffset,
          filterCount,
          quadOffset,
          quadCount,
          encoding.length,
          ...encoding,
        );
        // update to new codes
        curlayerIndex = layerIndex;
        codeStr = code.toString();
        curGlyphType = glyphType;
        curType = type;
        encoding = code;
        // update offests
        filterOffset += filterCount;
        quadOffset += quadCount;
        // reset counts
        filterCount = 0;
        quadCount = 0;
      }
      // update filters index, store it, and store the ID, hiding the count inside the id
      const resultMap = resultIndexMap.get(id) ?? 0;
      if (glyphType === 'point') {
        glyphFilterData.push(
          ...feature.filter,
          storeAsFloat32(resultMap),
          storeAsFloat32(id),
          -1,
          -1,
          -1,
          -1,
          -1,
          -1, // padding
        );
        filterCount++;
      } else {
        for (const filter of feature.filters) {
          glyphFilterData.push(
            ...filter,
            storeAsFloat32(resultMap),
            storeAsFloat32(id),
            -1, // padding
          );
          filterCount++;
        }
      }
      glyphQuads.push(...quads);
      const quadSize = curGlyphType === 'point' ? QUAD_SIZE_TEXT : QUAD_SIZE_PATH;
      const qCount = quads.length / quadSize;
      quadCount += qCount;
      // add the feature's index for each quad
      for (let i = 0; i < qCount; i++) glyphQuadIDs.push(resultMap);
      // add color data
      if (color.length > 0) glyphColors.push(...color.map((c) => c / 255));
      else for (let i = 0; i < qCount; i++) glyphColors.push(1, 1, 1, 1);
    }
    // store last set
    if (quadCount > 0 || filterCount > 0) {
      featureGuide.push(
        curlayerIndex,
        ~~(curGlyphType === 'path'),
        ~~(curType === 'icon'),
        filterOffset,
        filterCount,
        quadOffset,
        quadCount,
        encoding.length,
        ...encoding,
      );
    }

    // filter data
    const glyphFilterBuffer = new Float32Array(glyphFilterData).buffer;
    // unused by WebGPU
    const glyphFilterIDBuffer = new Uint8ClampedArray([0]).buffer;
    // quad draw data
    const glyphQuadBuffer = new Float32Array(glyphQuads).buffer;
    // actually an index buffer not ID buffer
    const glyphQuadIDBuffer = new Uint32Array(glyphQuadIDs).buffer;
    const glyphColorBuffer = new Float32Array(glyphColors).buffer;
    const featureGuideBuffer = new Float32Array(featureGuide).buffer;

    const message: GlyphData = {
      mapID,
      type: 'glyph' as const,
      sourceName,
      tileID,
      glyphFilterBuffer,
      glyphFilterIDBuffer,
      glyphQuadBuffer,
      glyphQuadIDBuffer,
      glyphColorBuffer,
      featureGuideBuffer,
    };
    // ship the data
    postMessage(message, [
      glyphFilterBuffer,
      glyphFilterIDBuffer,
      glyphQuadBuffer,
      glyphQuadIDBuffer,
      glyphColorBuffer,
      featureGuideBuffer,
    ]);
  }
}

/**
 * Store a value as a 32 bit float
 * @param u32value - a 32 bit unsigned integer
 * @returns a 32 bit float
 */
function storeAsFloat32(u32value: number): number {
  const buffer = new ArrayBuffer(4);
  const u32View = new Uint32Array(buffer);
  const f32View = new Float32Array(buffer);

  u32View[0] = u32value;
  return f32View[0];
}

/**
 * Decode HTML entities
 * @param input - the string to decode
 * @returns the decoded string
 */
function decodeHtmlEntities(input: string): string {
  return input.replace(/&#x([0-9A-Fa-f]+);/g, function (_, hex: string) {
    return String.fromCharCode(parseInt(hex, 16));
  });
}
