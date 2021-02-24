const BlendProjection = require('./blend').default
const mat4 = require('./mat4').default
const { S2Point, tileXYFromSTZoom, bboxST, updateFace, tileHash } = require('s2projection')

const blendProjection = new BlendProjection()

const lon = 0
const lat = 0
const zoom = 20
const radius = 1000

blendProjection.setPosition(lon, lat, zoom)

const matrix = blendProjection.getMatrix()

const zoomLevel = zoom << 0
const tileSize = 1 << zoomLevel
let point = S2Point.fromLonLat(-lon, lat)
let [face, s, t] = point.toST()
if (s < 0 || s === 1 || t < 0 || t === 1) [face, s, t] = updateFace(face, s, t)
let [x, y] = tileXYFromSTZoom(s, t, zoomLevel)
console.log('x, y', x, y)
let stBbox = bboxST(x, y, zoomLevel)
console.log('stBbox', stBbox)
// let hash = tileHash(face, zoomLevel, x, y)

console.log()

const topLeft = S2Point.fromSTGL(face, stBbox[0], stBbox[3])
console.log('topLeft', topLeft)
topLeft.normalize()
topLeft.mul(radius)
console.log('topLeft normalized', topLeft)
const topLeftProjected = mat4.project(matrix, [topLeft.x, topLeft.y, topLeft.z])
console.log('topLeftProjected', topLeftProjected)

console.log()

const bottomRight = S2Point.fromSTGL(face, stBbox[2], stBbox[1])
console.log('bottomRight', bottomRight)
bottomRight.normalize()
bottomRight.mul(radius)
console.log('bottomRight normalized', bottomRight)
const bottomRightProjected = mat4.project(matrix, [bottomRight.x, bottomRight.y, bottomRight.z])
console.log('bottomRightProjected', bottomRightProjected)

// console.log(proj)





// projection Float32Array(16) [3.047619104385376, 0, 0, 0, 0, 7.607726573944092, 0, 0, 0, 0, -1.0000200271606445, -1, 0, 0, 8.0001802444458, 10]
// zoom: 0

// projection Float32Array(16) [8.673911094665527, 0, 0, 0, 0, 21.652555465698242, 0, 0, 0, 0, -1.0000200271606445, -1, 0, 0, 8.0001802444458, 10]
// zoom: 1.5090000000000001

// projection Float32Array(16) [195081.4375, 0, 0, 0, 0, 486978.9375, 0, 0, 0, 0, -1.0000200271606445, -1, 0, 0, 1.000040054321289, 3]
// zoom: 17.703000000000014
