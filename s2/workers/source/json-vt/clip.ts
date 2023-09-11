/** MODULES **/
import type JsonVT from '.'
import createFeature from './feature'
/** TYPES **/
import type { JSONTile } from './tile'
import type { FeatureVector } from './feature'

type Sections = [
  FeatureVector[],
  FeatureVector[],
  FeatureVector[],
  FeatureVector[]
]

export default function clip (features: FeatureVector[], tile: JSONTile, s2json: JsonVT): Sections {
  const sections: Sections = [[], [], [], []] // [bl, br, tl, tr]
  const { i, j, zoom, minS, minT, maxS, maxT } = tile
  const scale = 1 << zoom
  const k1 = 0.5 / s2json.extent
  const k2 = 0.5 - k1
  const k3 = 0.5 + k1
  const k4 = 1 + k1

  let tl = null
  let bl = null
  let tr = null
  let br = null

  const left = _clip(features, scale, i - k1, i + k3, 0, minS, maxS, s2json)
  const right = _clip(features, scale, i + k2, i + k4, 0, minS, maxS, s2json)

  if (left !== null) {
    bl = _clip(left, scale, j - k1, j + k3, 1, minT, maxT, s2json)
    tl = _clip(left, scale, j + k2, j + k4, 1, minT, maxT, s2json)
    if (bl !== null) sections[0].push(...bl)
    if (tl !== null) sections[2].push(...tl)
  }

  if (right !== null) {
    br = _clip(right, scale, j - k1, j + k3, 1, minT, maxT, s2json)
    tr = _clip(right, scale, j + k2, j + k4, 1, minT, maxT, s2json)
    if (br !== null) sections[1].push(...br)
    if (tr !== null) sections[3].push(...tr)
  }

  return sections
}

/* clip features between two vertical or horizontal axis-parallel lines:
 *     |        |
 *  ___|___     |     /
 * /   |   \____|____/
 *     |        |
 *
 * k1 and k2 are the line coordinates
 * axis: 0 for x, 1 for y
 * minAxis and maxAxis: minimum and maximum coordinate value for all features
 */
function _clip (
  features: FeatureVector[],
  scale: number,
  k1: number,
  k2: number,
  axis: 0 | 1,
  minAxis: number,
  maxAxis: number,
  s2json: JsonVT
): null | FeatureVector[] {
  // scale
  k1 /= scale
  k2 /= scale
  // prep buffer
  const buffer = (k2 - k1) / s2json.extent * s2json.buffer

  if (minAxis >= k1 && maxAxis < k2) return features // trivial accept
  else if (maxAxis < k1 || minAxis >= k2) return null // trivial reject

  const clipped: FeatureVector[] = []

  for (const feature of features) {
    const { type } = feature

    const min = axis === 0 ? feature.minS : feature.minT
    const max = axis === 0 ? feature.maxS : feature.maxT

    if (min >= k1 && max < k2) { // trivial accept
      clipped.push(feature)
      continue
    } else if (max < k1 || min >= k2) { // trivial reject
      continue
    }

    let newGeometry: any = []

    if (type === 'Point' || type === 'MultiPoint') {
      clipPoints(feature.geometry, newGeometry, k1, k2, axis)
    } else if (type === 'LineString') {
      clipLine(feature.geometry, newGeometry, k1 - buffer, k2 + buffer, axis, false)
    } else if (type === 'MultiLineString') {
      clipLines(feature.geometry, newGeometry, k1 - buffer, k2 + buffer, axis, false)
    } else if (type === 'Polygon') {
      clipLines(feature.geometry, newGeometry, k1 - buffer, k2 + buffer, axis, true)
    } else if (type === 'MultiPolygon') {
      for (const polygon of feature.geometry) {
        const newPolygon: number[][] = []
        clipLines(polygon, newPolygon, k1 - buffer, k2 + buffer, axis, true)
        if (newPolygon.length > 0) newGeometry.push(newPolygon)
      }
    }

    let newType = type
    if (newGeometry.length > 0) {
      if (type === 'LineString' || type === 'MultiLineString') {
        if (newGeometry.length === 1) {
          newType = 'LineString'
          newGeometry = newGeometry[0]
        } else {
          newType = 'MultiLineString'
        }
      }
      if (type === 'Point' || type === 'MultiPoint') {
        newType = newGeometry.length === 3 ? 'Point' : 'MultiPoint'
      }

      clipped.push(createFeature(newType, newGeometry, feature.properties, feature.face))
    }
  }

  return clipped.length > 0 ? clipped : null
}

function clipPoints (
  geom: number[],
  newGeom: number[],
  k1: number,
  k2: number,
  axis: 0 | 1
): void {
  for (let i = 0; i < geom.length; i += 3) {
    const a = geom[i + axis]
    if (a >= k1 && a < k2) addPoint(newGeom, geom[i], geom[i + 1], geom[i + 2])
  }
}

function clipLine (
  geom: number[],
  newGeom: number[][],
  k1: number,
  k2: number,
  axis: 0 | 1,
  isPolygon: boolean
): void {
  let slice: number[] = []
  const intersect = axis === 0 ? intersectX : intersectY

  for (let i = 0; i < geom.length - 3; i += 3) {
    const ax = geom[i]
    const ay = geom[i + 1]
    const az = geom[i + 2]
    const bx = geom[i + 3]
    const by = geom[i + 4]
    const a = axis === 0 ? ax : ay
    const b = axis === 0 ? bx : by
    let exited = false

    if (a < k1) {
      // ---|-->  | (line enters the clip region from the left)
      if (b > k1) intersect(slice, ax, ay, bx, by, k1)
    } else if (a > k2) {
      // |  <--|--- (line enters the clip region from the right)
      if (b < k2) intersect(slice, ax, ay, bx, by, k2)
    } else {
      addPoint(slice, ax, ay, az)
    }
    if (b < k1 && a >= k1) {
      // <--|---  | or <--|-----|--- (line exits the clip region on the left)
      intersect(slice, ax, ay, bx, by, k1)
      exited = true
    }
    if (b > k2 && a <= k2) {
      // |  ---|--> or ---|-----|--> (line exits the clip region on the right)
      intersect(slice, ax, ay, bx, by, k2)
      exited = true
    }

    if (!isPolygon && exited) {
      newGeom.push(slice)
      slice = []
    }
  }

  // add the last point
  let last = geom.length - 3
  const ax = geom[last]
  const ay = geom[last + 1]
  const az = geom[last + 2]
  const a = axis === 0 ? ax : ay
  if (a >= k1 && a <= k2) addPoint(slice, ax, ay, az)

  // close the polygon if its endpoints are not the same after clipping
  last = slice.length - 3
  if (isPolygon && last >= 3 && (slice[last] !== slice[0] || slice[last + 1] !== slice[1])) {
    addPoint(slice, slice[0], slice[1], slice[2])
  }

  // add the final slice
  if (slice.length > 0) newGeom.push(slice)
}

function clipLines (
  geom: number[][],
  newGeom: number[][],
  k1: number,
  k2: number,
  axis: 0 | 1,
  isPolygon: boolean
): void {
  for (const line of geom) {
    clipLine(line, newGeom, k1, k2, axis, isPolygon)
  }
}

function addPoint (out: number[], x: number, y: number, z: number): void {
  out.push(x, y, z)
}

function intersectX (
  out: number[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x: number
): number {
  const t = (x - ax) / (bx - ax)
  addPoint(out, x, ay + (by - ay) * t, 1)

  return t
}

function intersectY (
  out: number[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  y: number
): number {
  const t = (y - ay) / (by - ay)
  addPoint(out, ax + (bx - ax) * t, y, 1)

  return t
}
