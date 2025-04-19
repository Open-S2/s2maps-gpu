import type Session from './session.js';
import type { Face, LayerDefinition } from 'style/style.spec.js';
import type { SourceFlushMessage, TileRequest } from '../worker.spec.js';
import type { VectorPointGeometry, VectorPolygonGeometry } from 'gis-tools/index.js';

/** Local Tile Properties */
export interface LocalTileProperties {
  id: string;
  face: number;
  zoom: number;
  i: number;
  j: number;
}

/** Boundary describing the tile shape */
export interface FeatureBoundary {
  extent: number;
  properties: LocalTileProperties;
  geometry: VectorPolygonGeometry;
}

/** Point describing the tile */
export interface GetFeatureName {
  extent: number;
  properties: LocalTileProperties;
  geometry: VectorPointGeometry;
}

/** Local Tile */
export interface LocalTile {
  face: Face;
  zoom: number;
  i: number;
  j: number;
  extent: number;
  layers: {
    boundary: {
      extent: 1;
      length: 1;
      features: FeatureBoundary[];
    };
    name: {
      extent: 1;
      length: 1;
      features: GetFeatureName[];
    };
  };
}

/** Local Source */
export default class LocalSource {
  name: string;
  isTimeFormat = false;
  styleLayers: LayerDefinition[];
  session: Session;
  textEncoder: TextEncoder = new TextEncoder();
  /**
   * @param name - the name of the source
   * @param session - the session
   * @param layers - the layers
   */
  constructor(name: string, session: Session, layers: LayerDefinition[]) {
    this.name = name;
    this.session = session;
    this.styleLayers = layers;
  }

  /** a no-op for local sources; nothing to build */
  build(): void {
    /* no-op */
  }

  /**
   * Get a tile
   * @param mapID - the map requesting the tile
   * @param tile - the tile request
   * @param flushMessage - the flush message to send a report to
   */
  tileRequest(mapID: string, tile: TileRequest, flushMessage: SourceFlushMessage): void {
    const { id, face, zoom, i, j } = tile;

    this.#flush(flushMessage);

    const data: LocalTile = {
      face,
      zoom,
      i,
      j,
      extent: 1,
      layers: {
        boundary: {
          extent: 1,
          length: 1,
          features: [
            {
              extent: 1,
              properties: { id: String(id), face, zoom, i, j },
              geometry: {
                type: 'Polygon',
                is3D: false,
                coordinates: [
                  [
                    { x: 0, y: 0 },
                    { x: 1, y: 0 },
                    { x: 1, y: 1 },
                    { x: 0, y: 1 },
                    { x: 0, y: 0 },
                  ],
                ],
              },
            },
          ],
        },
        name: {
          extent: 1,
          length: 1,
          features: [
            {
              extent: 1,
              properties: { id: String(id), face, zoom, i, j },
              geometry: {
                type: 'Point',
                is3D: false,
                coordinates: { x: 0.5, y: 0.5 },
              },
            },
          ],
        },
      },
    };
    // encode for transfer
    const uint8data = this.textEncoder.encode(JSON.stringify(data)).buffer;
    // request a worker and post
    const worker = this.session.requestWorker();
    worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: name, data: uint8data }, [
      uint8data,
    ]);
  }

  /** @param flushMessage - flushMessage */
  #flush(flushMessage: SourceFlushMessage): void {
    const layers = this.styleLayers.filter((layer) => layer.source === this.name);
    for (const { layerIndex } of layers) flushMessage.layersToBeLoaded.add(layerIndex);
  }
}
