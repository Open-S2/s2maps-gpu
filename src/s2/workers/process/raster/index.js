// @flow
const IS_CHROME: boolean = navigator.userAgent.indexOf('Chrome') > -1

export default function processRaster (mapID: string, tile: TileRequest,
  sourceName: string, parent: boolean, data: Blob, postMessage: Function) {
  const { hash } = tile
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1335594
  let built = true
  const getImage = (IS_CHROME)
    ? createImageBitmap(data, { imageOrientation: 'flipY', premultiplyAlpha: 'premultiply' })
    : (typeof createImageBitmap === 'function')
      ? createImageBitmap(data)
      : new Promise((resolve) => { built = false; resolve(data.arrayBuffer()) })
  getImage
    .then(image => postMessage({ mapID, type: 'rasterdata', built, source: sourceName, tileID: hash, image }, [image]))
    .catch(err => { console.log('ERROR', err) })
}
