// @flow
import { S2Point, bboxST } from 's2projection' // https://github.com/Regia-Corporation/s2projection
import type { Face } from 's2projection' // https://github.com/Regia-Corporation/s2projection/blob/master/src/S2Projection.js#L4
import Style from '../style'

import type { StyleLayers } from '../style'

// tiles are designed to create mask geometry and store prebuilt layer data handed off by the worker pool
// whenever rerenders are called, they will access these tile objects for the layer data / vaos
// before managing sources asyncronously, a tile needs to synchronously place spherical background
// data to ensure we get no awkward visuals
export default class Tile {
  face: Face
  zoom: number
  x: number
  y: number
  layers: StyleLayers
  center: Float32Array = new Float32Array(4) // [number (x), number (y), number (z), 1 (w)]
  bbox: [number, number, number, number]
  division: number
  id: number
  constructor (face: number, zoom: number, x: number, y: number, hash: number) {
    this.face = face
    this.zoom = zoom
    this.x = x
    this.y = y
    this.id = hash
    this.bbox = bboxST(x, y, zoom)
    this._createCenter()
    this._createDivision()
    this._buildMaskGeometry()
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
    this.center[3] = 1
  }

  _createDivision () {
    // the zoom determines the number of divisions necessary to maintain a visually
    // asthetic spherical shape. As we zoom in, the tiles are practically flat,
    // so division is less useful
    // y = mx + b
    const z = Math.min(this.zoom, 12) // we want 0 divisions once we hit zoom 12
    this.division = Math.max(Math.floor(-64 / 12 * z) + 64, 1)
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
  }
}
