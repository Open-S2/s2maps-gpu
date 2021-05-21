// @flow
const IS_CHROME: boolean = navigator.userAgent.indexOf('Chrome') > -1

export default async function processRaster (mapID: string, tile: TileRequest,
  sourceName: string, parent: boolean, data: ArrayBuffer, postMessage: Function) {
  const { hash } = tile
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1335594
  let built = true
  const getImage = (IS_CHROME)
    ? createImageBitmap(new Blob([data]), { imageOrientation: 'flipY', premultiplyAlpha: 'premultiply' })
    : (typeof createImageBitmap === 'function')
      ? createImageBitmap(new Blob([data]))
      : new Promise((resolve) => { built = false; resolve(data) })
  // build
  const image = await getImage
  // send off
  if (image) postMessage({ mapID, type: 'rasterdata', built, source: sourceName, tileID: hash, image }, [image])
}
