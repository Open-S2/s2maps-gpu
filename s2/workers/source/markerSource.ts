import { toProjection } from 'geometry'; // GeoJSON conversion and preprocessing
import { transformPoint } from './jsonVT/transform';
import { fromLonLat, toST } from 'geometry/s2/s2Point';
import { projectX, projectY } from './jsonVT/convert';

import type { JSONVectorPointsFeature } from './jsonVT/tile';
import type { Session } from '.';
import type { Face, JSONCollection, Properties, VectorPoint } from 'gis-tools';
import type { LayerDefinition, Projection, SourceMetadata } from 'style/style.spec';
import type { SourceFlushMessage, TileRequest } from '../worker.spec';

/**
 *
 */
export interface MarkerDefinition {
  id?: number;
  lon: number;
  lat: number;
  html?: string; // HTMLElement
  properties?: Record<string, unknown>;
  geometry?: VectorPoint;
}

/**
 *
 */
interface MarkerProperties extends Properties {
  __markerID: number;
}

/**
 *
 */
export interface Marker {
  id?: number;
  html?: string; // HTMLElement
  properties: MarkerProperties;
  geometry: VectorPoint;
}

/**
 *
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
   * @param name
   * @param session
   * @param projection
   * @param layers
   */
  constructor(name: string, session: Session, projection: Projection, layers: LayerDefinition[]) {
    this.name = name;
    this.session = session;
    this.projection = projection;
    this.styleLayers = layers;
  }

  /**
   * @param _mapID
   * @param metadata
   */
  build(_mapID: string, metadata?: SourceMetadata): void {
    const json: JSONCollection | undefined = metadata?.data;
    const markers: MarkerDefinition[] = [];
    if (json !== undefined) {
      const geojson = toProjection(json, 'WM');
      for (const feature of geojson.features) {
        if (feature.type === 'Feature' && feature.geometry.type === 'Point') {
          const marker: MarkerDefinition = {
            id: feature.id,
            lon: feature.geometry.coordinates[0],
            lat: feature.geometry.coordinates[1],
            properties: feature.properties,
          };
          markers.push(marker);
        }
      }
    }
    this.addMarkers(markers);
  }

  /**
   * @param markers
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
          ? toST(fromLonLat(lon, lat))
          : [0 as Face, projectX(lon, 'WM'), projectY(lat, 'WM')];
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
   * @param ids
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
   * @param mapID
   * @param tile
   * @param flushMessage
   */
  tileRequest(mapID: string, tile: TileRequest, flushMessage: SourceFlushMessage): void {
    const { name } = this;
    const { face, zoom, bbox, i, j } = tile;
    const tileZoom = 1 << zoom;
    const features: JSONVectorPointsFeature[] = [];
    // get bounds of tile
    const [minS, minT, maxS, maxT] = bbox;
    // find all markers in st bounds
    for (const [, marker] of this[face]) {
      const { properties, geometry } = marker;
      const { x, y } = geometry;
      if (x >= minS && x < maxS && y >= minT && y < maxT) {
        features.push({
          type: 1,
          properties,
          extent: 8_192,
          geometry: [transformPoint(x, y, 8_192, tileZoom, i, j)],
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
      extent: 8_192,
      face,
      zoom,
      i,
      j,
      layers: { default: { extent: 8_192, features, length: features.length } },
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

  // If no data, we still have to let the tile worker know so it can prepare a proper flush
  // as well as manage cases like "invert" type data.
  /**
   * @param mapID
   * @param tile
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
   * @param flushMessage
   */
  #sourceFlush(flushMessage: SourceFlushMessage): void {
    const { name } = this;
    const layers = this.styleLayers.filter((layer) => layer.source === name);
    for (const { layerIndex } of layers) flushMessage.layersToBeLoaded.add(layerIndex);
  }
}
