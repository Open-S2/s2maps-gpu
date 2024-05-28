import type {
  VectorGeometry,
  VectorLine,
  VectorLines,
  VectorMultiPoly,
  VectorPoints,
  VectorPoly
} from 'open-vector-tile'
import type { Point } from 'geometry'
import type { TileRequest } from 'workers/worker.spec'

// 1) scale up by distance between tiles (if parent is 2 zooms above, you double size twice)
// 2) shift x and y by position of current tile
// 3) clip the geometry by 0->extent (include buffer if not points)
export default function scaleShiftClip (
  geometry: VectorGeometry,
  type: number,
  extent: number,
  tile: TileRequest
): VectorGeometry {
  const { parent } = tile
  if (parent === undefined) return geometry
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
  if (type === 1) return scaleShiftClipPoints(geometry as VectorPoints, extent, xShift, yShift, scale)
  else if (type === 2 || type === 3 || type === 4) return scaleShiftClipLines(geometry as VectorLines, type, extent, xShift, yShift, scale)
  else return geometry
}

function scaleShiftClipLines (
  geometry: VectorLines | VectorPoly | VectorMultiPoly,
  type: 2 | 3 | 4,
  extent: number,
  xShift: number,
  yShift: number,
  scale: number
): VectorGeometry {
  // shift & scale
  if (type === 4) {
    for (const poly of geometry) {
      for (const line of poly) shiftScale(line as VectorLine, xShift, yShift, scale)
    }
  } else {
    for (const line of geometry) shiftScale(line as VectorLine, xShift, yShift, scale)
  }
  // clip
  let newGeometry: VectorGeometry = []
  if (type === 4) {
    const newGeo: VectorMultiPoly = []
    for (const poly of geometry) {
      const newPoly: VectorLines = []
      for (const line of poly) newPoly.push(...clipLine(line as VectorLine, extent, true))
      if (newPoly.length > 0) newGeo.push(newPoly)
    }
    newGeometry = newGeo
  } else {
    const newGeo: VectorLines = []
    for (const line of geometry) {
      newGeo.push(...clipLine(line as VectorLine, extent, type === 3))
    }
    newGeometry = newGeo
  }

  if (newGeometry.length > 0) return newGeometry
  else return []
}

function scaleShiftClipPoints (
  geometry: VectorPoints,
  extent: number,
  xShift: number,
  yShift: number,
  scale: number
): VectorPoints {
  // shift & scale
  shiftScale(geometry, xShift, yShift, scale)
  // clip
  for (let i = 0; i < geometry.length; i++) {
    const point = geometry[i]
    if (point.x < 0 || point.x > extent || point.y < 0 || point.y > extent) {
      geometry.splice(i, 1)
      i--
    }
  }

  return geometry
}

function shiftScale (
  points: VectorPoints,
  xShift: number,
  yShift: number,
  scale: number
): void {
  for (const point of points) {
    point.x = (point.x - xShift) * scale
    point.y = (point.y - yShift) * scale
  }
}

export function clipLines (
  lines: VectorLines,
  extent: number,
  isPolygon: boolean,
  buffer: number = 80
): VectorLines {
  const res: VectorLines = []
  for (const line of lines) res.push(...clipLine(line, extent, isPolygon, buffer))
  return res
}

// uses a buffer of 80 as default
function clipLine (
  line: VectorLine,
  extent: number,
  isPolygon: boolean,
  buffer: number = 80
): VectorLines {
  const res: VectorLines = []
  const vertical: VectorLines = []

  // slice vertically
  _clipLine(line, vertical, -buffer, extent + buffer, 1, isPolygon)
  // slice horizontally
  for (const vertLine of vertical) _clipLine(vertLine, res, -buffer, extent + buffer, 0, isPolygon)

  return res
}

function _clipLine (
  line: VectorLine,
  newGeom: VectorLines,
  k1: number,
  k2: number,
  axis: 0 | 1,
  isPolygon: boolean
): void {
  let slice: Point[] = []
  const intersect = axis === 0 ? intersectX : intersectY
  const len = line.length - 1

  for (let i = 0; i < len; i++) {
    const ax = line[i].x
    const ay = line[i].y
    const bx = line[i + 1].x
    const by = line[i + 1].y
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
      slice.push({ x: ax, y: ay })
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
  const ax = line[len].x
  const ay = line[len].y
  const a = axis === 0 ? ax : ay
  if (a >= k1 && a <= k2) slice.push({ x: ax, y: ay })

  // close the polygon if its endpoints are not the same after clipping
  if (isPolygon && slice.length < 3) return
  const last = slice.length - 1
  if (isPolygon && (slice[last].x !== slice[0].x || slice[last].y !== slice[0].y)) {
    slice.push({ x: slice[0].x, y: slice[0].y })
  }

  // add the final slice
  if (slice.length > 0) newGeom.push(slice)
}

function intersectX (
  out: Point[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x: number
): void {
  const t = (x - ax) / (bx - ax)
  out.push({ x, y: ay + (by - ay) * t })
}

function intersectY (
  out: Point[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  y: number
): void {
  const t = (y - ay) / (by - ay)
  out.push({ x: ax + (bx - ax) * t, y })
}
