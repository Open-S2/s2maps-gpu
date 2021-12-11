// @flow
import postprocessPoint from './postprocessPoint'
import preprocessPoint from './preprocessPoint'

import type { Feature } from '../'
import type { TileRequest } from '../../../workerPool'
import type { Layer } from '../../../../style/styleSpec'

export default function processPoint (mapID: string, tile: TileRequest,
  sourceName: string, features: Array<Feature>, postMessage: Function) {
  const { id, zoom } = tile
  const { type } = features[0].sourceLayer

  for (const feature of features) preprocessPoint(feature, zoom)

  postprocessPoint(mapID, `${sourceName}:${type}`, id, features, postMessage, type === 'heatmap')
}
