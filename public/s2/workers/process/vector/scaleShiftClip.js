// @flow
import type { TileRequest, ParentLayer } from '../tile.worker.js'

// 1) scale up by distance between tiles (if parent is 2 zooms above, you double size twice)
// 2) shift x and y by position of current tile
// 3) clip the geometry by 0->extent (include buffer if not points)
export default function scaleShiftClip (geometry: Array<any>, type: number,
  extent: number, tile: TileRequest, parent: ParentLayer) {
  const parentZoom = parent.zoom
  let { i, j, zoom } = tile
  // get the scale
  const scale = 1 << (zoom - parentZoom)
  // get x and y shift
  let xShift = 0
  let yShift = 0
  while (zoom > parentZoom) {
    const div = 1 << (zoom - parentZoom)
    if (i % 2 !== 0) xShift += extent / div
    if (j % 2 !== 0) yShift += extent / div
    // decrement
    i = i >> 1
    j = j >> 1
    zoom--
  }
  // build
  if (type === 1) return scaleShiftClipPoints(geometry, extent, xShift, yShift, scale)
  else if (type === 2 || type === 3 || type === 4) return scaleShiftClipLines(geometry, type, extent, xShift, yShift, scale)
}

function scaleShiftClipLines (geometry: Array<[number, number]>, type: number,
  extent: number, xShift: number, yShift: number, scale: number) {
  // shift & scale
  if (type === 4) {
    for (const poly of geometry) for (const line of poly) shiftScale(line, xShift, yShift, scale)
  } else {
    for (const line of geometry) shiftScale(line, xShift, yShift, scale)
  }
  // clip
  let newGeometry = []
  if (type === 4) {
    for (const poly of geometry) {
      const newPoly = []
      for (const line of poly) newPoly.push(...clipLine(line, extent, true))
      if (newPoly.length) newGeometry.push(newPoly)
    }
  } else {
    for (const line of geometry) {
      newGeometry.push(...clipLine(line, extent, type === 3))
    }
  }

  if (newGeometry.length) return newGeometry
}

function scaleShiftClipPoints (geometry: Array<[number, number]>, extent: number,
  xShift: number, yShift: number, scale: number) {
  // shift & scale
  shiftScale(geometry, xShift, yShift, scale)
  // clip
  for (let i = 0; i < geometry.length; i++) {
    const point = geometry[i]
    if (point[0] < 0 || point[0] > extent || point[1] < 0 || point[1] > extent) {
      geometry.splice(i, 1)
      i--
    }
  }

  return geometry
}

function shiftScale (points: Array<[number, number]>, xShift: number,
  yShift: number, scale: number) {
  for (const point of points) {
    point[0] = (point[0] - xShift) * scale
    point[1] = (point[1] - yShift) * scale
  }
}

// uses a buffer of 20 as default
function clipLine (line: Array<[number, number]>, extent: number, isPolygon: boolean): Array<[number, number]> {
  const res = []
  let vertical = []

  // slice vertically
  _clipLine(line, vertical, -80, extent + 80, 1, isPolygon)
  // slice horizontally
  for (const vertLine of vertical) _clipLine(vertLine, res, -80, extent + 80, 0, isPolygon)

  return res
}

function _clipLine (line: Array<[number, number]>, newGeom: Array<[number, number]> | Array<Array<[number, number]>>,
  k1: number, k2: number, axis: 0 | 1, isPolygon: boolean) {
  let slice = []
  const intersect = axis === 0 ? intersectX : intersectY
  const len = line.length - 1

  for (let i = 0; i < len; i++) {
    const ax = line[i][0]
    const ay = line[i][1]
    const bx = line[i + 1][0]
    const by = line[i + 1][1]
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
      slice.push([ax, ay])
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
  const ax = line[len][0]
  const ay = line[len][1]
  const a = axis === 0 ? ax : ay
  if (a >= k1 && a <= k2) slice.push([ax, ay])

  // close the polygon if its endpoints are not the same after clipping
  if (isPolygon && slice.length < 3) return
  const last = slice.length - 1
  if (isPolygon && (slice[last][0] !== slice[0][0] || slice[last][1] !== slice[0][1])) {
    slice.push([slice[0][0], slice[0][1]])
  }

  // add the final slice
  if (slice.length) newGeom.push(slice)
}

function intersectX (out: Array<[number, number]>, ax: number, ay: number, bx: number, by: number, x: number) {
  const t = (x - ax) / (bx - ax)
  out.push([x, ay + (by - ay) * t])
}

function intersectY (out: Array<[number, number]>, ax: number, ay: number, bx: number, by: number, y: number) {
  const t = (y - ay) / (by - ay)
  out.push([ax + (bx - ax) * t, y])
}
