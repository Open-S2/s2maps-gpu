const { S2Point, degToRad, updateFace, tileHash, tileXYFromSTZoom, bboxST } = require('s2projection')
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
  const tiles = []
  const tileSet = new Set()

  projection.onZoom(zoom)
  projection.onMove(lon, lat)

  const matrix = projection.getMatrix()

  if (zoom < 1) return [[0, 0, 0, 0], [1, 0, 0, 0], [2, 0, 0, 0], [3, 0, 0, 0], [4, 0, 0, 0], [5, 0, 0, 0]]
  // get starting point position
  // let point = S2Point.fromLonLat(-lon, lat)
  let point = S2Point.fromLonLat(-projection.lon, projection.lat)
  // let point = S2Point.fromLonLatGL(lon, lat)
  // WebGL has different axis for each
  // const projectedPoint = mat4.project(matrix, [point.y, point.z, point.x, 1])

  const [face, s, t] = point.toST()
  if (s < 0 || s === 1 || t < 0 || t === 1) [face, s, t] = updateFace(face, s, t)
  const [x, y] = tileXYFromSTZoom(s, t, zoom)
  const stBbox = bboxST(x, y, zoom)
  console.log('s, t', s, t)
  console.log('stBbox', stBbox)
  console.log(' ')
  const edgeLength = stBbox[2] - stBbox[0]
  // iterate from edge points of current tile moving left, down, up, right, adding tiles and continuing the cache
  // while edgePoint is inside the projection (both within the view & not behind other pieces of the sphere)
  // For both checks, we run the curent x,y,z through the projection matrix. If the return value is within
  // our width and height (-1 to 1 for both width and height) than we add the pixels dx, dy to a bounding box.
  // the dx and dy parameters are found by finding the difference from the pixels x, y of our starting point.
  // if the edge finds itself within the bounding box x and y, the edge will not be added.
  getTiles(face, zoom, stBbox[0], stBbox[1], matrix, edgeLength, tiles, tileSet, [0, 0], 1)
  getTiles(face, zoom, stBbox[0], stBbox[1] + edgeLength, matrix, edgeLength, tiles, tileSet, [0, 0], 3)
  getTiles(face, zoom, stBbox[0] - edgeLength, stBbox[1], matrix, edgeLength, tiles, tileSet, [0, 0], 0)
  getTiles(face, zoom, stBbox[0] + edgeLength, stBbox[1], matrix, edgeLength, tiles, tileSet, [0, 0], 2)

  return tiles
}

function getTiles (face, zoom, s, t, matrix, edgeLength, tiles, tileSet, bounds, direction) { // direction: 0->left; 1->down; 2->right; 3->up
  // When getTiles is called each time, the s or t was updated. So we need to check that it is in the face bounds. Otherwise update.
  const tileSize = 1 << zoom
  if (s < 0 || s === 1 || t < 0 || t === 1) [face, s, t] = updateFace(face, s, t)

  // now assured we have a proper s, t, and face, we check cases. 2 cases that we just return.
  // 1) out of bounds (greater than 1 or less than -1). 2) new point is inside the bounds
  const point = S2Point.fromSTGL(face, s, t)
  const projectedPoint = mat4.project(matrix, [point.x, point.y, point.z])
  console.log('TESTTESTESTETST')
  // face, zoom, s, t 3 2 0.25 0
  const testPoint = S2Point.fromSTGL(1, 1, 1)
  // [ 2.2381883116539654, 2.003366438014493, 0.3949702601396499 ]
  const testProjectedPoint = mat4.project(matrix, [testPoint.x, testPoint.y, testPoint.z])
  // const screenX = (testProjectedPoint[0] *  0.5 + 0.5) * projection.width
  // const screenZ = (testProjectedPoint[1] * -0.5 + 0.5) * projection.height
  // console.log('screenX', screenX)
  // console.log('screenZ', screenZ)
  console.log('testProjectedPoint', testProjectedPoint)
  console.log('TESTTESTESTETST')
  console.log('point', point)
  console.log('projectedPoint', projectedPoint)
  console.log('face, zoom, s, t', face, zoom, s, t)
  console.log('direction', direction)
  console.log('----')
  if (projectedPoint[0] < -1 || projectedPoint[0] > 1 || projectedPoint[1] < -1 || projectedPoint[1] > 1) { console.log('RETURN'); return }
  let culledTile = true
  if (projectedPoint[0] < bounds[0]) { bounds[0] = projectedPoint[0]; culledTile = false }
  else if (projectedPoint[0] > bounds[1]) { bounds[1] = projectedPoint[0]; culledTile = false }
  else if (projectedPoint[1] < bounds[0]) { bounds[0] = projectedPoint[1]; culledTile = false }
  else if (projectedPoint[1] > bounds[1]) { bounds[1] = projectedPoint[1]; culledTile = false }
  if (culledTile) { console.log('RETURN'); return }
  // if we make it here, add the 4 tiles surrounding the edge point assuming we have not already hit them
  let [x, y] = tileXYFromSTZoom(s, t, zoom);
  let [yNegFace, yNegX, yNegY] = [face, x, y - 1];
  let [xNegFace, xNegX, xNegY] = [face, x - 1, y];
  let [xNegYNegFace, xNegYNegX, xNegYNegY] = [face, x - 1, y - 1];
  if (y - 1 < 0) {
    [yNegFace, yNegX, yNegY] = updateFace(yNegFace, yNegX, yNegY, tileSize);
    [xNegYNegFace, xNegYNegX, xNegYNegY] = updateFace(xNegYNegFace, xNegYNegX, xNegYNegY, tileSize);
  }
  if (x - 1 < 0) [xNegFace, xNegX, xNegY] = updateFace(xNegFace, xNegX, xNegY, tileSize);
  if (xNegYNegX < 0 || xNegYNegY < 0) [xNegYNegFace, xNegYNegX, xNegYNegY] = updateFace(xNegYNegFace, xNegYNegX, xNegYNegY, tileSize);
  console.log('face, x, y', face, x, y)
  console.log('yNegFace, yNegX, yNegY', yNegFace, yNegX, yNegY)
  console.log('xNegFace, xNegX, xNegY', xNegFace, xNegX, xNegY)
  console.log('xNegYNegFace, xNegYNegX, xNegYNegY', xNegYNegFace, xNegYNegX, xNegYNegY)
  console.log(' ')
  const zoomLevel = zoom << 0
  const hash = tileHash(face, zoomLevel, x, y)
  const yNegHash = tileHash(yNegFace, zoomLevel, yNegX, yNegY)
  const xNegHash = tileHash(xNegFace, zoomLevel, xNegX, xNegY)
  const xNegYNegHash = tileHash(xNegYNegFace, zoomLevel, xNegYNegX, xNegYNegY)
  if (!tileSet.has(hash)) { tiles.push([face, zoomLevel, x, y, hash]) }
  if (!tileSet.has(yNegHash)) { tileSet.add(yNegHash); tiles.push([yNegFace, zoomLevel, yNegX, yNegY, yNegHash]) }
  if (!tileSet.has(xNegHash)) { tileSet.add(xNegHash); tiles.push([xNegFace, zoomLevel, xNegX, xNegY, xNegHash]) }
  if (!tileSet.has(xNegYNegHash)) { tileSet.add(xNegYNegHash); tiles.push([xNegYNegFace, zoomLevel, xNegYNegX, xNegYNegY, xNegYNegHash]) }
  // we want to move vertically as much as we can, and then try left and right afterwords
  if (direction === 0) { // left
    getTiles(face, zoom, s - edgeLength, t, matrix, edgeLength, tiles, tileSet, bounds, 0)
  } else if (direction === 2) { // right
    getTiles(face, zoom, s + edgeLength, t, matrix, edgeLength, tiles, tileSet, bounds, 2)
  } else if (direction === 1) { // down
    getTiles(face, zoom, s, t - edgeLength, matrix, edgeLength, tiles, tileSet, bounds, 1)
    getTiles(face, zoom, s - edgeLength, t, matrix, edgeLength, tiles, tileSet, [projectedPoint[0], projectedPoint[0]], 0)
    getTiles(face, zoom, s + edgeLength, t, matrix, edgeLength, tiles, tileSet, [projectedPoint[0], projectedPoint[0]], 2)
  } else { // 3 - up
    getTiles(face, zoom, s, t + edgeLength, matrix, edgeLength, tiles, tileSet, bounds, 3)
    getTiles(face, zoom, s - edgeLength, t, matrix, edgeLength, tiles, tileSet, [projectedPoint[0], projectedPoint[0]], 0)
    getTiles(face, zoom, s + edgeLength, t, matrix, edgeLength, tiles, tileSet, [projectedPoint[0], projectedPoint[0]], 2)
  }
}

const tiles = getTilesInView(2, 0, 0)
// const tiles = getTilesInView(4, 90, 30)
// const tiles = getTilesInView(1, -30, 0)

console.log('tiles', tiles)
