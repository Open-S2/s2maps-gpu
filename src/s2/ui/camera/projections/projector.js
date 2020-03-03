// @flow
import * as mat4 from '../../../util/mat4'
import { S2Point, tileXYFromSTZoom, bboxST, updateFace, tileHash, degToRad } from 's2projection'

import type { Projection } from './projection'

export type ProjectionConfig = {
  translation?: [number, number, number],
  maxLatRotation?: number,
  zoom?: number,
  minzoom?: number,
  maxzoom?: number,
  lon?: number,
  lat?: number,
  scale?: number,
  zNear?: number,
  zFar?: number,
  width?: number,
  height?: number
}

export default class Projector implements Projection {
  view: Float32Array = new Float32Array(16) // [zoom, lon, lat, angle, pitch, ...extensions]
  translation: [number, number, number] = [0, 0, -10] // only z should change for visual effects
  maxLatRotation: number = 80 // 80 deg
  prevZoom: number = 0
  zoom: number = 0
  minzoom: number = 0
  maxzoom: number = 20
  lon: number = 0
  lat: number = 0
  scale: number = 1 // this is always going to be between 1 and 2
  zNear: number = 0.5 // static; just for draw calls
  zFar: number = 100 // static; just for draw calls
  width: number = 400 // default canvas width
  height: number = 300 // default canvas height
  multiplier: number = 1
  sizeMatrices: { [number | string]: Float32Array } = {} // key is tileSize
  dirty: boolean = true
  constructor (config?: ProjectionConfig = {}) {
    if (config.translation) this.translation = config.translation
    if (config.maxLatRotation) this.maxLatRotation = config.maxLatRotation
    if (config.zoom) this.prevZoom = this.zoom = config.zoom
    if (config.lon) this.lon = config.lon
    if (config.lat) this.lat = config.lat
    if (config.scale) this.scale = config.scale
    if (config.zNear) this.zNear = config.zNear
    if (config.zFar) this.zFar = config.zFar
    if (config.width) this.width = config.width
    if (config.height) this.height = config.height
    if (config.canvasMultiplier) this.multiplier = config.canvasMultiplier
  }

  setStyleParameters (style) {
    const { minzoom, maxzoom, zoom, lon, lat } = style
    // clamp values and ensure minzoom is less than maxzoom
    this.minzoom = (minzoom < -10) ? -10 : (minzoom > maxzoom) ? maxzoom - 1 : (minzoom > 29) ? 29 : minzoom
    this.maxzoom = (maxzoom > 30) ? 30 : (maxzoom < this.minzoom) ? this.minzoom + 1 : maxzoom
    // set initial position
    this.setLonLat(-lon, lat)
    this.setZoom(zoom)
  }

  zoomChange (): number {
    return Math.floor(this.zoom) - Math.floor(this.prevZoom)
  }

  resize (width: number, height: number) {
    this.width = width
    this.height = height
    this.sizeMatrices = {}
    this.dirty = true
  }

  setZoom (zoom: number) {
    this.zoom = zoom
    this.view[0] = this.zoom
    this.onZoom()
  }

  onMove (movementX?: number = 0, movementY?: number = 0, multiplierX?: number = 3, multiplierY?: number = 3) {
    this.lon += movementX / (multiplierX * (2 * Math.pow(2, Math.max(this.zoom, 0))))
    this.lat += movementY / (multiplierY * (2 * Math.pow(2, Math.max(this.zoom, 0))))
    // check that we don't over move on the x axis
    if (this.lat > this.maxLatRotation) { this.lat = this.maxLatRotation }
    else if (this.lat < -this.maxLatRotation) { this.lat = -this.maxLatRotation }
    // update view
    this.view[1] = this.lon
    this.view[2] = this.lat
    // if we hit 360, just swing back to 0
    while (this.lon >= 360) { this.lon -= 360 }
    while (this.lon <= 0) { this.lon += 360 }
    this.sizeMatrices = {}
    this.dirty = true
  }

  setLonLat (lon: number, lat: number) {
    this.lon = lon
    this.lat = lat
    this.onMove()
  }

  getMatrix (size: number): Float32Array {
    const matrix = this.getMatrixAtSize(size)
    // translate position
    mat4.translate(matrix, this.translation)
    // rotate position
    mat4.rotate(matrix, [degToRad(this.lat), degToRad(this.lon), 0])

    return matrix
  }

  getTilesInView (size?: number = 512): Array<[number, number, number, number, number]> { // [face, zoom, x, y, hash]
    if (this.zoom < 1) return [[0, 0, 0, 0, 2], [1, 0, 0, 0, 3], [2, 0, 0, 0, 4], [3, 0, 0, 0, 5], [4, 0, 0, 0, 6], [5, 0, 0, 0, 7]]
    const tiles = []
    const checkList = []
    const checkedTiles = new Set()
    const zoomLevel = this.zoom << 0
    const tileSize = 1 << zoomLevel
    const matrix = this.getMatrix(size)

    // grab the first tile while we prep
    let point = S2Point.fromLonLat(-this.lon, this.lat)
    let [face, s, t] = point.toST()
    if (s < 0 || s === 1 || t < 0 || t === 1) [face, s, t] = updateFace(face, s, t);
    let [x, y] = tileXYFromSTZoom(s, t, zoomLevel)
    let stBbox = bboxST(x, y, zoomLevel)
    let hash = tileHash(face, zoomLevel, x, y)
    checkedTiles.add(hash)
    tiles.push([face, zoomLevel, x, y, hash])
    // add the surounding tiles
    addSuroundingTiles(face, zoomLevel, x, y, tileSize, checkList, checkedTiles)

    do {
      // from current face, zoomLevel, x, y: grab the surrounding 8 tiles, refine to actual face boundaries, than adding to checked as we go
      [face, x, y, hash] = checkList.pop();
      // grab the bbox from the tile
      stBbox = bboxST(x, y, zoomLevel)
      // grab the four points from the bbox and project them
      const topLeft = S2Point.fromSTGL(face, stBbox[0], stBbox[3])
      topLeft.normalize()
      const topLeftProjected = mat4.project(matrix, [topLeft.x, topLeft.y, topLeft.z])
      const topRight = S2Point.fromSTGL(face, stBbox[2], stBbox[3])
      topRight.normalize()
      const topRightProjected = mat4.project(matrix, [topRight.x, topRight.y, topRight.z])
      const bottomLeft = S2Point.fromSTGL(face, stBbox[0], stBbox[1])
      bottomLeft.normalize()
      const bottomLeftProjected = mat4.project(matrix, [bottomLeft.x, bottomLeft.y, bottomLeft.z])
      const bottomRight = S2Point.fromSTGL(face, stBbox[2], stBbox[1])
      bottomRight.normalize()
      const bottomRightProjected = mat4.project(matrix, [bottomRight.x, bottomRight.y, bottomRight.z])
      // check if any of the 4 edge points or lines interact with a -1 to 1 x and y projection plane
      // if tile is part of the view, we add to tiles and tileSet and add all surounding tiles
      if (
        (topLeftProjected[0] <= 1 && topLeftProjected[0] >= -1 && topLeftProjected[1] <= 1 && topLeftProjected[1] >= -1) ||
        (topRightProjected[0] <= 1 && topRightProjected[0] >= -1 && topRightProjected[1] <= 1 && topRightProjected[1] >= -1) ||
        (bottomLeftProjected[0] <= 1 && bottomLeftProjected[0] >= -1 && bottomLeftProjected[1] <= 1 && bottomLeftProjected[1] >= -1) ||
        (bottomRightProjected[0] <= 1 && bottomRightProjected[0] >= -1 && bottomRightProjected[1] <= 1 && bottomRightProjected[1] >= -1) ||
        boxIntersect(topLeftProjected[0], topLeftProjected[1], bottomLeftProjected[0], bottomLeftProjected[1]) || // leftLine
        boxIntersect(bottomRightProjected[0], bottomRightProjected[1], topRightProjected[0], topRightProjected[1]) || // rightLine
        boxIntersect(bottomLeftProjected[0], bottomLeftProjected[1], bottomRightProjected[0], bottomRightProjected[1]) || // bottomLine
        boxIntersect(topRightProjected[0], topRightProjected[1], topLeftProjected[0], topLeftProjected[1]) // topLine
      ) {
        tiles.push([face, zoomLevel, x, y, hash])
        addSuroundingTiles(face, zoomLevel, x, y, tileSize, checkList, checkedTiles)
      }
    } while (checkList.length)

    // console.log('tiles', tiles)
    // console.log('zoom', zoomLevel)
    return tiles
  }
}

// check all 8 tiles around the current tile
function addSuroundingTiles (face, zoomLevel, x, y, tileSize, checkList, checkedTiles) {
  findTile(face, zoomLevel, x - 1, y + 1, tileSize, checkList, checkedTiles) // topLeft
  findTile(face, zoomLevel, x, y + 1, tileSize, checkList, checkedTiles) // top
  findTile(face, zoomLevel, x + 1, y + 1, tileSize, checkList, checkedTiles) // topRight
  findTile(face, zoomLevel, x + 1, y, tileSize, checkList, checkedTiles) // right
  findTile(face, zoomLevel, x + 1, y - 1, tileSize, checkList, checkedTiles) // bottomRight
  findTile(face, zoomLevel, x, y - 1, tileSize, checkList, checkedTiles) // bottom
  findTile(face, zoomLevel, x - 1, y - 1, tileSize, checkList, checkedTiles) // bottomLeft
  findTile(face, zoomLevel, x - 1, y, tileSize, checkList, checkedTiles) // left
}

// first check the face, x, y are correct.. update them if out of bounds
// if the we have not checked the tile yet, we add it to checked tiles and the checkList
function findTile (face, zoom, x, y, tileSize, checkList, checkedTiles) {
  while (x < 0 || x === tileSize || y < 0 || y === tileSize) [face, x, y] = updateFace(face, x, y, tileSize)
  const hash = tileHash(face, zoom, x, y)
  if (!checkedTiles.has(hash)) {
    checkedTiles.add(hash)
    checkList.push([face, x, y, hash])
  }
}

function boxIntersect (x1, y1, x2, y2) {
  if (
    lineIntersect(x1, y1, x2, y2, -1, -1, -1, 1) || // leftLineBox
    lineIntersect(x1, y1, x2, y2, 1, -1, 1, 1) || // rightLineBox
    lineIntersect(x1, y1, x2, y2, -1, -1, 1, -1) || // bottomLineBox
    lineIntersect(x1, y1, x2, y2, -1, 1, 1, 1) // topLineBox
  ) return true
  return false
}

function lineIntersect (x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
  if (!denom) return false
  const lambda = ((y4 - y3) * (x4 - x1) + (x3 - x4) * (y4 - y1)) / denom
  const gamma = ((y1 - y2) * (x4 - x1) + (x2 - x1) * (y4 - y1)) / denom
  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1)
}
