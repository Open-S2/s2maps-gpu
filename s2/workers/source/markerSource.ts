import { convert, transformPoint } from 'gis-tools/index.js';

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

/** Marker metadata */
export interface MarkerMetadata {
  html?: string; // HTMLElement as a string
}

/** Marker definition tracking lon/lat, html, and properties associated with it */
export interface MarkerDefinition {
  id?: number;
  face?: Face;
  properties: Properties;
  point: VectorPoint;
  metadata?: MarkerMetadata;
}

/** Properties associated with markers */
interface MarkerProperties extends Properties {
  __markerID: number;
}

/** A storage container for Marker */
export interface Marker {
  id: number;
  metadata?: MarkerMetadata;
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
    const { projection } = this;
    const json: JSONCollection<MarkerMetadata> | undefined = metadata?.data;
    if (json !== undefined) {
      const features = convert(projection === 'WM' ? 'WG' : 'S2', json, true, true);
      for (const feature of features) {
        const { id, face, properties, metadata } = feature;
        if (feature.geometry.type === 'Point') {
          this.addMarker({ point: feature.geometry.coordinates, face, properties, id, metadata });
        } else if (feature.geometry.type === 'MultiPoint') {
          for (const point of feature.geometry.coordinates) {
            this.addMarker({ point, face, properties, id, metadata });
          }
        }
      }
    }
  }

  /**
   * Add marker to the source
   * @param marker - the marker to add
   */
  addMarker(marker: MarkerDefinition): void {
    let { point, face, properties, id, metadata } = marker;
    // if no id, let's create one
    if (id === undefined) {
      id = this.idGen++;
      if (this.idGen >= Number.MAX_SAFE_INTEGER) this.idGen = 0;
    }
    // store
    properties.__markerID = id;
    this[face ?? 0].set(id, {
      id,
      metadata,
      properties: { __markerID: id, ...properties },
      geometry: point,
    });
  }

  /**
   * Delete marker(s)
   * @param ids - the id(s) of the marker(s) to delete
   */
  deleteMarkers(ids: number[]): void {
    for (const id of ids) {
      this[0].delete(id);
      this[1].delete(id);
      this[2].delete(id);
      this[3].delete(id);
      this[4].delete(id);
      this[5].delete(id);
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
    const uint8data = this.textEncoder.encode(JSON.stringify(data)).buffer;
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
    const data = textEncoder.encode('{"layers":{}}').buffer;
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
