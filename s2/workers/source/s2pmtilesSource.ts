import { S2PMTilesReader } from 'gis-tools';
import Source from './source';

import type { SourceMetadata } from 'style/style.spec';
import type { TileRequest } from '../worker.spec';

/**
 * # S2 PMTiles Source
 *
 * Wrapper for the `S2PMTilesReader`. Fetch tiles as needed.
 */
export default class S2PMTilesSource extends Source {
  version = 1;
  reader!: S2PMTilesReader;
  /** @param mapID - the id of the map to build tiles for */
  override async build(mapID: string): Promise<void> {
    this.reader = new S2PMTilesReader(this.path, true);
    const metadata = await this.reader.getMetadata();
    // modify the type to ensure we are using a vector
    metadata.type = 'vector';
    this._buildMetadata(metadata as unknown as SourceMetadata, mapID);
  }
  /**
   * Here, we use the memory mapped file directory tree system to find our data
   * @param mapID - the id of the map
   * @param tile - the tile request
   * @param sourceName - the name of the source
   */
  override async _tileRequest(mapID: string, tile: TileRequest, sourceName: string): Promise<void> {
    const { type, session, size } = this;
    const { parent, type: tileType } = tile;
    const { face, zoom, i, j } = parent ?? tile;

    const bytes =
      tileType === 'S2'
        ? await this.reader.getTileS2(face, zoom, i, j)
        : await this.reader.getTile(zoom, i, j);

    if (bytes !== undefined) {
      const data = bytes.buffer;
      const worker = session.requestWorker();
      worker.postMessage({ mapID, type, tile, sourceName, data, size }, [data as ArrayBuffer]);
    } else {
      this._flush(mapID, tile, sourceName);
    }
  }
}
