import JsonVT from './jsonVT';
import Source from './source';
import { WMPointCluster } from './pointCluster';

import type { JSONCollection } from 'gis-tools';
import type { SourceMetadata } from 'style/style.spec';
import type { TileRequest } from '../worker.spec';

/**
 *
 */
export default class JSONSource extends Source {
  json!: JsonVT | WMPointCluster;
  /**
   * @param mapID
   * @param metadata
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
      this.json = new JsonVT(json, { ...metadata, projection: this.projection });
    }
    const { projection, minzoom, maxzoom, faces } = this.json;
    this._buildMetadata(
      {
        type: 'vector',
        minzoom,
        maxzoom,
        faces: [...faces],
        layers: { default: { minzoom: 0, maxzoom: 30, fields: {} } },
        extension: projection === 'S2' ? 's2json' : 'geojson',
        attributions: json.attributions,
      },
      mapID,
    );
  }

  /**
   * @param mapID
   * @param tile
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
