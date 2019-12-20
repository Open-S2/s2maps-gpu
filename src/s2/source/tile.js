// @flow
import { S2Point, bboxST } from 's2projection' // https://github.com/Regia-Corporation/s2projection
// import { S2Point, tileHash, bboxST } from 's2projection' // https://github.com/Regia-Corporation/s2projection
// import { TileCache } from './'

import type { Face } from 's2projection' // https://github.com/Regia-Corporation/s2projection/blob/master/src/S2Projection.js#L4
import type { StyleLayers } from '../style'

// The layer guide helps identify how to properly draw from the vertexBuffer/vertexIndex stack.
// All layers are merged into one VAO/indexBuffer/vertexBuffer/featureIndexBuffer set. This reduces complexity and improves draw speed.
// To ensure we draw in order and know the index ranges exist per layer, we maintain a 'Layer Guide'.
// the attributes object is for dataConditions and dataRanges.
export type FeatureGuide = {
  layerID: number,
  source: string,
  count: number,
  offset: number,
  type: string,
  featureCode: Float32Array
}

export type VectorTileSource = {
  type: 'vector',
  vertexArray: Float32Array,
  indexArray: Uint32Array,
  featureIndexArray: Uint8Array,
  vertexBuffer?: WebGLBuffer,
  indexBuffer?: WebGLBuffer,
  featureIndexBuffer?: WebGLBuffer,
  vao?: WebGLVertexArrayObject
}

export type SourceData = { [string | number]: VectorTileSource }

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
  bbox: [number, number, number, number]
  extent: number = 4096
  division: number
  sourceData: SourceData = {}
  featureGuide: Array<FeatureGuide> = []
  constructor (face: number, zoom: number, x: number, y: number, hash: number, size?: number = 512) {
    this.face = face
    this.zoom = zoom
    this.x = x
    this.y = y
    this.id = hash
    this.size = size
    this.bbox = bboxST(x, y, zoom)
    this._createDivision()
    this._buildMaskGeometry()
  }

  injectSourceData (source: string, vertexArray: Float32Array, indexArray: Uint32Array, featureIndexArray: Uint8Array, featureGuideArray: Uint32Array, layers: StyleLayers) {
    // store a reference to the source
    this.sourceData[source] = {
      vertexArray,
      indexArray,
      featureIndexArray
    }
    // we work off the featureGuideArray, adding to the buffer as we go
    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      // grab the size, layerID, count, and offset, and update the index
      const [layerID, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4)
      i += 4
      // create and store the featureGuide
      this.featureGuide.push({
        layerID,
        source,
        count,
        offset,
        type: layers[layerID].type,
        featureCode: new Float32Array([...featureGuideArray.slice(i, i + encodingSize)])
      })
      i += encodingSize
    }
    // because sources may be utilized in an out of order fashion inside the style.layers property,
    // but come in linearly, we need to sort.
    this.featureGuide.sort((a, b) => a.layerID - b.layerID)
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
    const { division, face } = this
    const indexLength = division + 1
    let t: number, s: number, point: S2Point, index: number, indexAbove: number
    // now we can build out the vertices and indices
    // vertices
    for (let j = 0; j <= division; j++) {
      t = dt / division * j + tB
      for (let i = 0; i <= division; i++) {
        s = ds / division * i + sB
        // create s2Point using WebGL's projection scheme, normalize, and than store
        point = S2Point.fromSTGL(face, s, t)
        point.normalize()
        vertices.push(...point.toFloats())
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
