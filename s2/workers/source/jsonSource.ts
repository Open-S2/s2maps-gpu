import Source from './source.js';
import { TileStore } from 'gis-tools/index.js';
import { WMPointCluster } from './pointCluster/index.js';

import type { JSONCollection } from 'gis-tools/index.js';
import type { SourceMetadata } from 'style/style.spec.js';
import type { TileRequest } from '../worker.spec.js';

/**
 * # JSON Source
 *
 * ## Description
 * A source that is a json file that contains geojson or s2json data.
 *
 * The json can be stored as a tile store or a point cluster.
 */
export default class JSONSource extends Source {
  json!: TileStore | WMPointCluster;
  /**
   * @param mapID - the id of the map to build for
   * @param metadata - the metadata for the source
   */
  override async build(mapID: string, metadata?: SourceMetadata): Promise<void> {
    const json =
      metadata?.data ??
      ((await this._fetch(`${this.path}`, mapID, true)) as unknown as JSONCollection);
    if (json === undefined) {
      this.active = false;
      console.error(`FAILED TO extrapolate ${this.path} json data`);
      return;
    }
    if (metadata?.cluster === true) {
      this.json = new WMPointCluster(metadata);
      this.json.addManyPoints(json);
      this.json.cluster();
    } else {
      // use the projection from the style
      this.json = new TileStore(json, { ...metadata, projection: this.projection });
    }
    const { projection, minzoom, maxzoom, faces } = this.json;
    this._buildMetadata(
      {
        type: 'vector',
        minzoom,
        maxzoom,
        faces: [...faces],
        layers: { default: { minzoom: 0, maxzoom: 30, drawTypes: [], shape: {} } },
        extension: projection === 'S2' ? 's2json' : 'geojson',
        attributions: 'attributions' in json ? json.attributions : {},
      },
      mapID,
    );
  }

  /**
   * Fetch a tile
   * @param mapID - the id of the map requesting data
   * @param tile - the tile request
   */
  override async _tileRequest(mapID: string, tile: TileRequest): Promise<void> {
    const { name, json, session, textEncoder } = this;
    const { id, face } = tile;

    if (json.faces.has(face)) {
      // grab the data
      const vectorTile = json.getTile(id);
      // prep worker
      const worker = session.requestWorker();
      if (Object.values(vectorTile?.layers ?? {}).length === 0) {
        this._flush(mapID, tile, name);
        return;
      }
      // compress
      const data = (await textEncoder.encode(JSON.stringify(vectorTile)).buffer) as ArrayBuffer;
      // send off
      worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: name, data }, [data]);
    } else {
      this._flush(mapID, tile, name);
    }
  }
}
