// @flow
import postprocessLine from './postprocessLine'
import preprocessLine from './preprocessLine'

import type { Feature } from '../'
import type { TileRequest } from '../../../workerPool'
import type { Layer } from '../../../../style/styleSpec'

export default function processLine (mapID: string, tile: TileRequest,
  sourceName: string, features: Array<Feature>, postMessage: Function) {
  const { division, id, zoom } = tile

  for (const feature of features) preprocessLine(feature, division, zoom)

  postprocessLine(mapID, `${sourceName}:line`, id, features, postMessage)
}
