// @flow
import { VectorTile } from 's2-vector-tile'
import { earclip } from 'earclip'

import type { StyleLayer } from '../style'
import type { TileRequest } from './map.worker.js'

export default function processVectorFeatures (vectorTile: VectorTile, layer: StyleLayer,
  tile: TileRequest, vertices: Array<number>, indices: Array<number>, layerGuide: Array<number>) {


}
