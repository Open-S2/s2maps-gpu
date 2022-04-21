// @flow
/* eslint-env worker */
import { isSafari } from '../../../util/browsers'
/* global createImageBitmap */
import type { TileRequest } from '../../workerPool'

export type RasterFeatureGuide = Array<{
  opacity: false | number,
  layerIndex: number,
  type: 'raster' | 'raster-dem' | 'sensors'
}>

export default async function processRaster (mapID: string, webgl1: boolean, tile: TileRequest, sourceName: string, parent: boolean,
  data: ArrayBuffer, layers: Array<Layer>) {
  // prep variables
  const { id, zoom, time } = tile
  const subSourceName = sourceName.split(':')[0]
  // filter layers to source
  const sourceLayers = layers.filter(layer => layer.source === subSourceName)
  // prebuild feature code if webgl1
  const featureGuides = []
  for (const { paint, layout, type, layerIndex } of sourceLayers) {
    featureGuides.push({ opacity: webgl1 && paint.opacity(null, {}, zoom), type, layerIndex })
  }
  // check if we should premultiplyAlpha
  // const premultiplyAlpha = sourceLayers.some(layer => layer.type === 'raster') ? 'premultiply' : 'none'
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1335594 - saved for posterity
  let built = true
  const getImage = (typeof createImageBitmap === 'function' && !isSafari)
    ? createImageBitmap(new Blob([data]), { premultiplyAlpha: 'none' })
    : new Promise((resolve) => { built = false; resolve(data) })
  // build
  const image = await getImage
  // send off
  if (image) postMessage({ mapID, type: 'raster', tileID: id, built, sourceName: `${sourceName}:raster`, featureGuides, image, time }, [image])
}
