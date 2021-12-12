// @flow
import preprocessFill from './preprocessFill'
import postprocessFill from './postprocessFill'

import type { Feature } from '../'
import type { TileRequest } from '../../../workerPool'

export default function processFill (mapID: string, tile: TileRequest,
  sourceName: string, features: Array<Feature>, postMessage: Function) {
  const { division, id } = tile

  for (const feature of features) preprocessFill(feature, division)

  postprocessFill(mapID, `${sourceName}:fill`, id, features, postMessage)
}
