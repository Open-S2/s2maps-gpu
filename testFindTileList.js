const { S2Point, degToRad, tileHash, tileXYFromSTZoom, bboxST } = require('s2projection')
const mat4 = require('./mat4').default
// const { mat4 } = require('gl-matrix')

class BlendProjection {
  translation = [0, 0, -10] // only z should change for visual effects
  zTranslateStart = -10
  zTranslateEnd = -3
  zoomEnd = 2
  zoom = 0
  lon = 0
  lat = 0
  scale = 1 // this is always going to be between 1 and 2
  zNear = 0.5
  zFar = 100 // static; just for draw calls
  width = 1680 // default canvas width
  height = 660 // default canvas height
  matrix = null

  resize (width, height) {
    this.width = width
    this.height = height
    this.matrix = null
  }

  onZoom (zoom) {
    this.zoom += zoom
    if (this.zoom > 22) this.zoom = 22
    if (this.zoom < 0) this.zoom = 0
    this.scale = Math.pow(2, zoom)
    // update transation
    this.translation[2] = Math.min(
      (((this.zTranslateEnd - this.zTranslateStart) / this.zoomEnd) * this.zoom) + this.zTranslateStart,
      this.zTranslateEnd
    )
    this.matrix = null
  }

  onMove (lon, lat) {
    this.lon -= lon
    this.lat += lat
    this.matrix = null
  }

  getMatrix () {
    if (this.matrix) return this.matrix
    const matrix = mat4.create()
    // get height and width ratios for each tile
    const widthRatio = this.width / (512 * this.scale)
    const heightRatio = this.height / (512 * this.scale)
    // create projection
    mat4.blend(matrix, -widthRatio / this.translation[2], -heightRatio / this.translation[2], this.zNear, this.zFar)
    // translate position
    mat4.translate(matrix, this.translation)
    // rotate position
    mat4.rotate(matrix, [degToRad(this.lat), degToRad(this.lon), 0])
    // store the matrix
    this.matrix = matrix

    return matrix
  }
}

const projection = new BlendProjection()

function getTilesInView (zoom, lon, lat) {
  projection.onZoom(zoom)
  projection.onMove(lon, lat)
  if (this.zoom < 1) return [[0, 0, 0, 0, 2], [1, 0, 0, 0, 3], [2, 0, 0, 0, 4], [3, 0, 0, 0, 5], [4, 0, 0, 0, 6], [5, 0, 0, 0, 7]]
  const tiles = []
  const checkList = []
  const checkedTiles = new Set()
  const zoomLevel = zoom << 0
  const tileSize = 1 << zoomLevel
  const matrix = projection.getMatrix()

  // grab the first tile while we prep
  let point = S2Point.fromLonLat(-projection.lon, projection.lat)
  let [face, s, t] = point.toST()
  if (s < 0 || s === 1 || t < 0 || t === 1) [face, s, t] = updateTile(face, s, t)
  let [x, y] = tileXYFromSTZoom(s, t, zoomLevel)
  let stBbox = bboxST(x, y, zoomLevel)
  let hash = tileHash(face, zoomLevel, x, y)
  checkedTiles.add(hash)
  tiles.push([face, zoomLevel, x, y, hash])
  // add the surounding tiles
  addSuroundingTiles(face, zoomLevel, x, y, tileSize, checkList, checkedTiles)

  do {
    // from current face, zoomLevel, x, y: grab the surrounding 8 tiles, refine to actual face boundaries, than adding to checked as we go
    [face, x, y, hash] = checkList.pop()
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
    // if tile is part of the view, we add to tiles and tileSet and run addSuroundingTiles on said tile
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

  return tiles
}

function boxIntersect (x1, y1, x2, y2) {
  // console.log('x1, y1, x2, y2', x1, y1, x2, y2)
  if (
    lineIntersect(x1, y1, x2, y2, -1, -1, -1, 1) || // leftLineBox
    lineIntersect(x1, y1, x2, y2, 1, -1, 1, 1) || // rightLineBox
    lineIntersect(x1, y1, x2, y2, -1, -1, 1, -1) || // bottomLineBox
    lineIntersect(x1, y1, x2, y2, -1, 1, 1, 1) // topLineBox
  ) {
    // console.log('STORE')
    return true
  }
  // console.log('REJECT')
  return false
}

function lineIntersect (x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
  if (!denom) return false
  const lambda = ((y4 - y3) * (x4 - x1) + (x3 - x4) * (y4 - y1)) / denom
  const gamma = ((y1 - y2) * (x4 - x1) + (x2 - x1) * (y4 - y1)) / denom
  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1)
}

// check all 8 tiles around the current tile
function addSuroundingTiles(face, zoomLevel, x, y, tileSize, checkList, checkedTiles) {
  findTile(face, zoomLevel, x - 1, y + 1, tileSize, checkList, checkedTiles), // topLeft
  findTile(face, zoomLevel, x, y + 1, tileSize, checkList, checkedTiles), // top
  findTile(face, zoomLevel, x + 1, y + 1, tileSize, checkList, checkedTiles), // topRight
  findTile(face, zoomLevel, x + 1, y, tileSize, checkList, checkedTiles), // right
  findTile(face, zoomLevel, x + 1, y - 1, tileSize, checkList, checkedTiles), // bottomRight
  findTile(face, zoomLevel, x, y - 1, tileSize, checkList, checkedTiles), // bottom
  findTile(face, zoomLevel, x - 1, y - 1, tileSize, checkList, checkedTiles), // bottomLeft
  findTile(face, zoomLevel, x - 1, y, tileSize, checkList, checkedTiles) // left
}

// first check the face, x, y are correct.. update them if out of bounds
// if the we have not checked the tile yet, we add it to checked tiles and the checkList
function findTile(face, zoom, x, y, tileSize, checkList, checkedTiles) {
  while (x < 0 || x === tileSize || y < 0 || y === tileSize) [face, x, y] = updateTile(face, x, y, tileSize)
  const hash = tileHash(face, zoom, x, y)
  if (!checkedTiles.has(hash)) {
    checkedTiles.add(hash)
    checkList.push([face, x, y, hash])
  }
}

// lat: 23.065019845499286
// lon: 75.24004701174681
// zoom: 1.9574999999999867
// const tiles = getTilesInView(1.9574999999999867, 75.24004701174681, 23.065019845499286)

// BUGGED
const tiles = getTilesInView(1, 0, 0)
// BUGGED
// const tiles = getTilesInView(4, 90, 30)
// const tiles = getTilesInView(1, -30, 0)
// const tiles = getTilesInView(1, 0, 0)

console.log('tiles', tiles, tiles.length)

function updateTile (face, s, t, size = 1) {
  const diff = (size === 1) ? size : size - 1
  if (face === 0) {
    if (s < 0) return [4, diff - t, size + s]
    else if (s === size) return [1, 0, t]
    else if (t < 0) return [5, s, size + t]
    else if (t === size) return [2, 0, diff - s]
  } else if (face === 1) {
    if (s < 0) return [0, size + s, t]
    else if (s == size) return [3, diff - t, 0]
    else if (t < 0) return [5, size + t, diff - s]
    else if (t === size) return [2, s, 0]
  } else if (face === 2) {
    if (s < 0) return [0, diff - t, size + s]
    else if (s === size) return [3, 0, t]
    else if (t < 0) return [1, s, size + t]
    else if (t === size) return [4, 0, diff - s]
  } else if (face === 3) {
    if (s < 0) return [2, size + s, t]
    else if (s === size) return [5, diff - t, 0]
    else if (t < 0) return [1, size + t, diff - s]
    else if (t === size) return [4, s, 0]
  } else if (face === 4) {
    if (s < 0) return [2, diff - t, size + s]
    else if (s === size) return [5, 0, t]
    else if (t < 0) return [3, s, size + t]
    else if (t === size) return [0, 0, diff - s]
  } else if (face === 5) {
    if (s < 0) return [4, size + s, t]
    else if (s === size) return [1, diff - t, 0]
    else if (t < 0) return [3, size + t, diff - s]
    else if (t === size) return [0, s, 0]
  }
}
