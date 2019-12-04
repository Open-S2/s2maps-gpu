// @flow
import { S2Point, tileHash, bboxST } from 's2projection' // https://github.com/Regia-Corporation/s2projection
import { TileCache } from './'

import type { Face } from 's2projection' // https://github.com/Regia-Corporation/s2projection/blob/master/src/S2Projection.js#L4
import type { StyleLayers } from '../style'

// The layer guide helps identify how to properly draw from the vertexBuffer/vertexIndex stack.
// All layers are merged into one VAO/indexBuffer/vertexBuffer set. This reduces complexity and improves draw speed.
// To ensure we draw in order and know the index ranges exist per layer, we maintain a 'Layer Guide'.
// the attributes object is for dataConditions and dataRanges.
export type LayerGuide = {
  parent: boolean,
  tile?: any, // should it be a parent reference
  source: string,
  layerID: number,
  count: number,
  offset: number,
  type: string,
  attributes: Object
}

export type VectorTileSource = {
  type: 'vector',
  vertexArray: Float32Array,
  indexArray: Uint32Array,
  vertexBuffer?: WebGLBuffer,
  indexBuffer?: WebGLBuffer,
  vao?: WebGLVertexArrayObject
}

// tiles are designed to create mask geometry and store prebuilt layer data handed off by the worker pool
// whenever rerenders are called, they will access these tile objects for the layer data / vaos
// before managing sources asyncronously, a tile needs to synchronously place spherical background
// data to ensure we get no awkward visuals.
// TODO: Every tile needs access to the painters context for creating and deleting the WebGLBuffer and WebGLVertexArrayObject
export default class Tile {
  id: number
  face: Face
  zoom: number
  x: number
  y: number
  size: number
  center: [number, number, number] = [0, 0, 0] // [number (x), number (y), number (z)]
  bbox: [number, number, number, number]
  extent: number = 4096
  division: number
  sourceData: { [string | number]: VectorTileSource } = {}
  layersGuide: Array<LayerGuide> = []
  constructor (face: number, zoom: number, x: number, y: number, hash: number, size?: number = 512) {
    this.face = face
    this.zoom = zoom
    this.x = x
    this.y = y
    this.id = hash
    this.size = size
    this.bbox = bboxST(x, y, zoom)
    this._createCenter()
    this._createDivision()
    this._buildMaskGeometry()
  }

  // find parent tile incase some source cache does not exist. Should the parent not have
  injectParentOrChildren (tileCache: TileCache) {
    // corner case, we are at min zoom
    if (this.zoom === 0) return
    // get parent hash
    const parentHash = tileHash(this.face, this.zoom - 1, Math.floor(this.x / 2), Math.floor(this.y / 2))
    // check if parent tile exists, if so inject
    if (tileCache.has(parentHash)) {
      const parent = tileCache.get(parentHash)
      // inject references to layersGuide from each parentTile. If a layerGuide is marked parent,
      // than it's the parents-parent and that can get messy if the user zooms in really fast, so we ignore.
      // sort according to ID
      for (const layerGuide of parent.layersGuide) {
        if (!layerGuide.parent) {
          const { source, layerID, count, offset, type, attributes } = layerGuide
          this.layersGuide.push({ parent: true, tile: parent, source, layerID, count, offset, type, attributes })
        }
      }
      this.layersGuide.sort((a, b) => a.layerID - b.layerID)
    }
  }

  injectSourceData (source: string, vertexArray: Float32Array, indexArray: Uint32Array, layerGuideArray: Uint32Array, layers: StyleLayers) {
    // store a reference to the source
    this.sourceData[source] = {
      vertexArray,
      indexArray
    }
    // we work off the layerGuideArray, adding to the buffer as we go
    const lgl = layerGuideArray.length
    let i = 0
    while (i < lgl) {
      // grab the size, layerID, count, and offset, and update the index
      const [layerID, count, offset, size] = layerGuideArray.slice(i, i + 4)
      i += 4
      // grab the layer and encodings and update index by size
      const layer = layers[layerID]
      const encodings = (size) ? [...layerGuideArray.slice(i, i + size)] : []
      i += size
      // create and store the layerGuide
      this.layersGuide.push({
        parent: false,
        source,
        layerID,
        count,
        offset,
        type: layer.type,
        attributes: this._parseAttributes(layer, encodings)
      })
    }
    // Since a parent or children can be injected, we need to first remove any instances of the "old" source data.
    // Since we only reference
    this.layersGuide = this.layersGuide.filter(lg => !(lg.parent && lg.source === source))
    // because sources may be utilized in an out of order fashion inside the style.layers property,
    // but come in linearly, we need to sort.
    this.layersGuide.sort((a, b) => a.layerID - b.layerID)
  }

  _parseAttributes(layer: StyleLayers, encodings: Array<number>) {
    const attributes = {}
    // parse layouts given encoding
    for (const l in layer.layout) {
      attributes[l] = layer.layout[l](encodings)
    }
    // parse paints given encoding
    for (const p in layer.paint) {
      attributes[p] = layer.paint[p](encodings)
    }
    return attributes
  }

  _createCenter () {
    // find corner x, y, z coordinates, and find the averages
    // The z value will sometimes be at the tips of the face, but that's ok as the delta z
    // is usually fairly small
    const bottomLeft = S2Point.fromSTGL(this.face, this.bbox[0], this.bbox[1])
    bottomLeft.normalize()
    const topRight = S2Point.fromSTGL(this.face, this.bbox[2], this.bbox[3])
    topRight.normalize()
    this.center[0] = (topRight.x + bottomLeft.x) / 2
    this.center[1] = (topRight.y + bottomLeft.y) / 2
    this.center[2] = (topRight.z + bottomLeft.z) / 2
  }

  _createDivision () {
    // the zoom determines the number of divisions necessary to maintain a visually
    // asthetic spherical shape. As we zoom in, the tiles are practically flat,
    // so division is less useful.
    // 0, 1 => 32  ;  2, 3 => 16  ;  4, 5 => 8  ;  6, 7 => 4  ;  8, 9 => 2  ;  10+ => 1
    const level = 1 << Math.max(Math.min(Math.floor(this.zoom / 2), 5), 0) // max 5 as its binary position is 32
    this.division = 32 / level
  }

  _buildMaskGeometry () {
    const vertices = []
    const indices = []
    // find change in s and change in t
    const dt = this.bbox[2] - this.bbox[0]
    const ds = this.bbox[3] - this.bbox[1]
    // y = mx + b, we need to find the potential b for each tiles s and t
    const tB = this.bbox[1]
    const sB = this.bbox[0]
    // grab the appropriate tile constants, and prep variables
    const { center, division, face } = this
    const indexLength = division + 1
    let t: number, s: number, point: S2Point, index: number, indexAbove: number
    // now we can build out the vertices and indices
    // vertices
    for (let j = 0; j <= division; j++) {
      t = dt / division * j + tB
      for (let i = 0; i <= division; i++) {
        s = ds / division * i + sB
        // create s2Point using WebGL's projection scheme, normalize, inject center, and than store
        point = S2Point.fromSTGL(face, s, t)
        point.normalize()
        point.subScalar(center)
        vertices.push(point.x, point.y, point.z)
      }
    }
    // indices
    for (let j = 0; j < division; j++) {
      // add degenerate if j is not 0
      if (j !== 0) indices.push((j + 1) * indexLength)
      for (let i = 0; i <= division; i++) {
        index = j * indexLength + i
        indexAbove = (j + 1) * indexLength + i
        indices.push(indexAbove, index)
      }
      // upon finishing a row, add a degenerate
      indices.push(index)
    }
    // create our initial vertices and indices:
    this.sourceData.mask = {
      vertexArray: new Float32Array(vertices),
      indexArray: new Uint32Array(indices)
    }
  }
}
