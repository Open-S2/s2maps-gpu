// @flow
import { S2Point, bboxST } from 's2projection' // https://github.com/Regia-Corporation/s2projection
import { Painter } from '../gl'

import type { Face } from 's2projection' // https://github.com/Regia-Corporation/s2projection/blob/master/src/S2Projection.js#L4
import type { StyleLayers } from '../style'

// The layer guide helps identify how to properly draw from the vertexBuffer/vertexIndex stack.
// All layers are merged into one VAO/indexBuffer/vertexBuffer set. This reduces complexity and improves draw speed.
// To ensure we draw in order and know the index ranges exist per layer, we maintain a 'Layer Guide'.
// the properties object is for dataConditions and dataRanges.
type LayerGuide = {
  layerID: number,
  count: number,
  offset: number,
  type: string,
  properties: Object
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
  vertices: Array<number> = []
  indices: Array<number> = []
  layersGuide: Array<LayerGuide> = []
  vertexBuffer: WebGLBuffer
  indexBuffer: WebGLBuffer
  vao: WebGLVertexArrayObject
  painter: Painter
  constructor (face: number, zoom: number, x: number, y: number, hash: number, painter: Painter, size?: number = 512) {
    this.face = face
    this.zoom = zoom
    this.x = x
    this.y = y
    this.id = hash
    this.painter = painter
    this.size = size
    this.bbox = bboxST(x, y, zoom)
    this._createCenter()
    this._createDivision()
    this._buildMaskGeometry()
  }

  injectSourceData (vertexArray: Float32Array, indexArray: Uint32Array, layerGuideArray: Uint32Array, layers: StyleLayers) {
    // Remember one tile can have multiple sources. So we need to potentially merge data from seperate worker submissions
    // This means we need to offset the indexArray to the current vertices size, and update the layer guide with the new
    // data along with the new offset for draw calls.
    const verticesOffset = this.vertices.length / 3
    const indicesOffset = this.indices.length
    // store the vertices
    this.vertices.push(...vertexArray)
    // store the indices with the appropriate vertex offset
    for (let i = 0, il = indexArray.length; i < il; i++) this.indices.push(indexArray[i] + verticesOffset)
    // we work off the layerGuideArray, adding to the buffer as we go
    const ll = layerGuideArray.length
    let i = 0
    while (i < ll) {
      // grab the size, layerID, count, and offset, and update the index
      const [layerID, count, offset, size] = layerGuideArray.slice(i, i + 4)
      i += 4
      // grab the layer and encodings and update index by size
      const layer = layers[layerID]
      const encodings = (size) ? [...layerGuideArray.slice(i, i + size)] : []
      i += size
      // create the layerGuide
      const layerGuide = {
        layerID,
        count,
        offset: offset + indicesOffset,
        type: layer.type,
        properties: this._parseProperties(layer, encodings)
      }
      // store the layerGuide
      this.layersGuide.push(layerGuide)
    }
    // because sources may be utilized in an out of order fashion inside the style.layers property,
    // but come in linearly, we need to sort.
    this.layersGuide.sort((a, b) => a.layerID - b.layerID)
    // lastly rebuild the vao
    this.painter.buildVAO(this)
  }

  _parseProperties(layer: StyleLayers, encodings: Array<number>) {
    const properties = {}
    // parse layouts given encoding
    for (const l in layer.layout) {
      properties[l] = layer.layout[l](encodings)
    }
    // parse paints given encoding
    for (const p in layer.paint) {
      properties[p] = layer.paint[p](encodings)
    }
    return properties
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
    // so division is less useful
    const z = Math.min(this.zoom, 12) // we want 0 divisions once we hit zoom 12
    this.division = Math.max(Math.floor(-32 / 12 * z) + 32, 1)
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
    // now we can build out the vertices and indices
    let j: number, i: number, bl: number, tr: number, t: number, s: number, st: S2Point
    const indexLength = this.division + 1
    for (j = 0; j <= this.division; j++) {
      t = dt / this.division * j + tB
      for (i = 0; i <= this.division; i++) {
        // vertices
        s = ds / this.division * i + sB
        st = S2Point.fromSTGL(this.face, s, t)
        st.normalize()
        st.subScalar(this.center)
        vertices.push(st.x, st.y, st.z)
        // indices
        if (j !== this.division && i !== this.division) {
          bl = j * indexLength + i
          tr = (j + 1) * indexLength + i + 1
          indices.push(
            bl, tr, (j + 1) * indexLength + i,
            tr, bl, j * indexLength + i + 1
          )
        }
      }
    }
    // create our initial vertices and indices:
    this.vertices = vertices
    this.indices = indices
    this.layersGuide.push({ layerID: -1, count: this.indices.length, offset: 0, type: 'fill', properties: {} })
    this.painter.buildVAO(this)
  }
}
