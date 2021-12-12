// @flow
/* eslint-env worker */
/* global createImageBitmap */
import type { TileRequest } from '../../workerPool'

export default async function processRaster (mapID: string, tile: TileRequest,
  sourceName: string, parent: boolean, data: ArrayBuffer, postMessage: Function) {
  const { id } = tile
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1335594
  let built = true
  const getImage = (typeof createImageBitmap === 'function')
    ? createImageBitmap(new Blob([data]), { premultiplyAlpha: 'premultiply' })
    : new Promise((resolve) => { built = false; resolve(data) })
  // build
  const image = await getImage
  // send off
  if (image) postMessage({ mapID, type: 'rasterdata', built, source: sourceName, tileID: id, image }, [image])
}
