import type { LayerDefinition } from 'style/style.spec'
import type { SourceFlushMessage, TileRequest } from '../worker.spec'
import type { JSONVectorTile } from './jsonVT/tile'
import type Session from './session'

export interface LocalTileProperties {
  id: bigint
  face: number
  zoom: number
  i: number
  j: number
}

export type GetFeatureBoundary = () => {
  properties: LocalTileProperties
  type: number
  loadGeometry: () => number[][][]
}

export type GetFeatureName = () => {
  properties: LocalTileProperties
  type: number
  loadGeometry: () => number[][]
}

export interface LocalTile {
  layers: {
    boundary: {
      extent: 8_192
      length: 1
      feature: GetFeatureBoundary
    }
    name: {
      extent: 8_192
      length: 1
      feature: GetFeatureName
    }
  }
}

export default class LocalSource {
  name: string
  isTimeFormat = false
  styleLayers: LayerDefinition[]
  session: Session
  textEncoder: TextEncoder = new TextEncoder()
  constructor (name: string, session: Session, layers: LayerDefinition[]) {
    this.name = name
    this.session = session
    this.styleLayers = layers
  }

  build (): void { /* no-op */ }

  tileRequest (mapID: string, tile: TileRequest, flushMessage: SourceFlushMessage): void {
    const { id, face, zoom, i, j } = tile

    this.#flush(flushMessage)

    const data: JSONVectorTile = {
      face,
      zoom,
      i,
      j,
      extent: 8_192,
      layers: {
        boundary: {
          extent: 8_192,
          length: 1,
          features: [
            {
              extent: 8_192,
              properties: { id: String(id), face, zoom, i, j },
              type: 3, // Polygon
              // @ts-expect-error - geometry is correct
              geometry: [[[0, 0], [8_192, 0], [8_192, 8_192], [0, 8_192], [0, 0]]]
            }
          ]
        },
        name: {
          extent: 8_192,
          length: 1,
          features: [
            {
              extent: 8_192,
              properties: { id: String(id), face, zoom, i, j },
              type: 1, // Point
              // @ts-expect-error - geometry is correct
              geometry: [[4096, 4096]]
            }
          ]
        }
      }
    }
    // encode for transfer
    const uint8data = (this.textEncoder.encode(JSON.stringify(data))).buffer as ArrayBuffer
    // request a worker and post
    const worker = this.session.requestWorker()
    worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: name, data: uint8data }, [uint8data])
  }

  #flush (flushMessage: SourceFlushMessage): void {
    const layers = this.styleLayers.filter(layer => layer.source === this.name)
    for (const { layerIndex } of layers) flushMessage.layersToBeLoaded.add(layerIndex)
  }
}
