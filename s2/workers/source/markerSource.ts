import {
  convert,
  pointFromLonLat,
  pointToST,
  projectX,
  projectY,
  transformPoint,
} from 'gis-tools/index.js';

import type { Session } from './index.js';
import type {
  Face,
  JSONCollection,
  Properties,
  VectorPoint,
  VectorPointFeature,
} from 'gis-tools/index.js';
import type { LayerDefinition, Projection, SourceMetadata } from 'style/style.spec.js';
import type { SourceFlushMessage, TileRequest } from '../worker.spec.js';

/** Marker definition tracking lon/lat, html, and properties associated with it */
export interface MarkerDefinition {
  id?: number;
  lon: number;
  lat: number;
  html?: string; // HTMLElement
  properties?: Record<string, unknown>;
  geometry?: VectorPoint;
}

/** Properties associated with markers */
interface MarkerProperties extends Properties {
  __markerID: number;
}

/** A storage container for Marker */
export interface Marker {
  id?: number;
  html?: string; // HTMLElement
  properties: MarkerProperties;
  geometry: VectorPoint;
}

/**
 * # Marker Source
 *
 * Store, process, and render markers. Handles both WM and S2 projections
 */
export default class MarkerSource {
  name: string;
  projection: Projection = 'S2';
  isTimeFormat = false;
  styleLayers: LayerDefinition[];
  idGen = 0;
  0 = new Map<number, Marker>();
  1 = new Map<number, Marker>();
  2 = new Map<number, Marker>();
  3 = new Map<number, Marker>();
  4 = new Map<number, Marker>();
  5 = new Map<number, Marker>();
  session: Session;
  textEncoder: TextEncoder = new TextEncoder();
  /**
   * @param name - name of the source
   * @param session - the session associated with the source data
   * @param projection - the projection to use (WM or S2)
   * @param layers - the style layers associated with this source
   */
  constructor(name: string, session: Session, projection: Projection, layers: LayerDefinition[]) {
    this.name = name;
    this.session = session;
    this.projection = projection;
    this.styleLayers = layers;
  }

  /**
   * Build the source
   * @param _mapID - the id of the map (unused)
   * @param metadata - the metadata associated with the source
   */
  build(_mapID: string, metadata?: SourceMetadata): void {
    const json: JSONCollection | undefined = metadata?.data;
    const markers: MarkerDefinition[] = [];
    if (json !== undefined) {
      const features = convert('WG', json, undefined, true);
      for (const feature of features) {
        if (feature.geometry.type === 'Point') {
          const marker: MarkerDefinition = {
            id: feature.id,
            lon: feature.geometry.coordinates.x,
            lat: feature.geometry.coordinates.y,
            properties: feature.properties,
          };
          markers.push(marker);
        }
      }
    }
    this.addMarkers(markers);
  }

  /**
   * Add marker(s) to the source
   * @param markers - the marker(s) to add
   */
  addMarkers(markers: MarkerDefinition[]): void {
    const { projection } = this;
    for (const marker of markers) {
      const { lon, lat } = marker;
      let { id, properties } = marker;
      if (properties === undefined) properties = {};
      // build face, s, t
      const [face, x, y] =
        projection === 'S2'
          ? pointToST(pointFromLonLat({ x: lon, y: lat }))
          : [0 as Face, projectX(lon), projectY(lat)];
      // if no id, let's create one
      if (id === undefined) {
        id = this.idGen++;
        if (this.idGen >= Number.MAX_SAFE_INTEGER) this.idGen = 0;
      }
      // store
      properties.__markerID = id;
      this[face].set(id, { properties: properties as MarkerProperties, geometry: { x, y } });
    }
  }

  /**
   * Delete marker(s)
   * @param ids - the id(s) of the marker(s) to delete
   */
  deleteMarkers(ids: number[]): void {
    for (const id of ids) {
      if (this[0].has(id)) this[0].delete(id);
      else if (this[1].has(id)) this[1].delete(id);
      else if (this[2].has(id)) this[2].delete(id);
      else if (this[3].has(id)) this[3].delete(id);
      else if (this[4].has(id)) this[4].delete(id);
      else if (this[5].has(id)) this[5].delete(id);
    }
  }

  /**
   * Process a tile request
   * @param mapID - the id of the map that is requesting data
   * @param tile - the tile request
   * @param flushMessage - the flush message function to call on completion
   */
  tileRequest(mapID: string, tile: TileRequest, flushMessage: SourceFlushMessage): void {
    const { name } = this;
    const { face, zoom, bbox, i, j } = tile;
    const tileZoom = 1 << zoom;
    const features: VectorPointFeature[] = [];
    // get bounds of tile
    const [minS, minT, maxS, maxT] = bbox;
    // find all markers in st bounds
    for (const [, marker] of this[face]) {
      const { properties, geometry } = marker;
      const { x, y } = geometry;
      if (x >= minS && x < maxS && y >= minT && y < maxT) {
        const geometry: VectorPoint = { x, y };
        transformPoint(geometry, tileZoom, i, j);
        features.push({
          type: 'VectorFeature',
          properties,
          geometry: { type: 'Point', is3D: false, coordinates: geometry },
        });
      }
    }
    // if markers fit within bounds, create a tile
    const length = features.length;
    // Flush and return
    if (length === 0) {
      this._flush(mapID, tile);
      return;
    }
    // build data object
    const data = {
      extent: 1,
      face,
      zoom,
      i,
      j,
      layers: { default: { extent: 1, features, length: features.length } },
    };
    // encode for transfer
    const uint8data = this.textEncoder.encode(JSON.stringify(data)).buffer as ArrayBuffer;
    // request a worker and post
    const worker = this.session.requestWorker();
    worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: name, data: uint8data }, [
      uint8data,
    ]);
    // let the source know we are loading a layer
    this.#sourceFlush(flushMessage);
  }

  /**
   * If no data, we still have to let the tile worker know so it can prepare a proper flush
   * as well as manage cases like "invert" type data.
   * @param mapID - the id of the map that is requesting data
   * @param tile - the tile request
   */
  _flush(mapID: string, tile: TileRequest): void {
    const { textEncoder, session, name } = this;
    // compress
    const data = textEncoder.encode('{"layers":{}}').buffer as ArrayBuffer;
    // send off
    const worker = session.requestWorker();
    worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: name, data }, [data]);
  }

  /**
   * Flush protocol for the source
   * @param flushMessage - the flush message function
   */
  #sourceFlush(flushMessage: SourceFlushMessage): void {
    const { name } = this;
    const layers = this.styleLayers.filter((layer) => layer.source === name);
    for (const { layerIndex } of layers) flushMessage.layersToBeLoaded.add(layerIndex);
  }
}
