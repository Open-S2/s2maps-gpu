import Source from './source'
import S2PMTilesReader from 's2-pmtiles/browser'

import type { Metadata } from './source'
import type { TileRequest } from '../worker.spec'

export default class S2PMTilesSource extends Source {
  version = 1
  isTimeFormat = false
  reader!: S2PMTilesReader
  async build (mapID: string): Promise<void> {
    this.reader = new S2PMTilesReader(this.path, true)
    const metadata = await this.reader.getMetadata()
    // modify the type to ensure we are using a vector
    metadata.type = 'vector'
    this._buildMetadata(metadata as Metadata, mapID)
  }

  // Here, we use the memory mapped file directory tree system to find our data
  async _tileRequest (
    mapID: string,
    tile: TileRequest,
    sourceName: string
  ): Promise<void> {
    const { type, session, size } = this
    const { parent, type: tileType } = tile
    const { face, zoom, i, j } = parent ?? tile

    const bytes = tileType === 'S2'
      ? await this.reader.getTileS2(face, zoom, i, j)
      : await this.reader.getTile(zoom, i, j)

    if (bytes !== undefined) {
      const data = bytes.buffer
      const worker = session.requestWorker()
      worker.postMessage({ mapID, type, tile, sourceName, data, size }, [data as ArrayBuffer])
    } else { this._flush(mapID, tile, sourceName) }
  }
}
