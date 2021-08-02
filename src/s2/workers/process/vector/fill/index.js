// @flow
import preprocessFill from './preprocessFill'
import postprocessFill from './postprocessFill'

import type { Feature } from '../'
import type { TileRequest } from '../../../workerPool'
import type { Layer } from '../../../../style/styleSpec'

export default function processFill (mapID: string, tile: TileRequest,
  sourceName: string, features: Array<Feature>, postMessage: Function) {
  const { division, hash } = tile

  for (const feature of features) preprocessFill(feature, division)

  postprocessFill(mapID, `${sourceName}:fill`, hash, features, postMessage)
}
