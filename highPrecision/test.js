const mat4 = require('./mat4').default
const { S2Point, bboxST, degToRad } = require('s2projection')

const width = 1080
const height = 600
const zNear = 0.5
const zFar = 100
const scale = 1
const translation = [0, 0, -10]

// get height and width ratios for each tile
const widthRatio = width / (512 * scale)
const heightRatio = height / (512 * scale)

const lat = 20
const lon = 0

// console.log('bbox', bbox)
const point = S2Point.fromLonLat(-lon, lat)
point.normalize()

const matrix = mat4.create()
// create projection
mat4.blend(matrix, widthRatio * (-1 / translation[2]), heightRatio * (-1 / translation[2]), zNear, zFar)
// mat4.blend(matrix, widthRatio, heightRatio, zNear, zFar)
// translate position
mat4.translate(matrix, translation)
// rotate position
mat4.rotate(matrix, [degToRad(lat), degToRad(lon), 0])


const projectedPoint = mat4.project(matrix, [point.x, point.y, point.z])
// const projectedPoint = mat4.multiplyVector(matrix, [point.x, point.y, point.z])
console.log('**** NORMAL *****')
console.log('matrix', matrix)
console.log('projection: ', projectedPoint)
console.log('_____ NORMAL _____')



/** PRECISION **/


const matrix2 = mat4.create()
const mv = mat4.create()
// create projection
mat4.blend(matrix2, widthRatio * (-1 / translation[2]), heightRatio * (-1 / translation[2]), zNear, zFar)
// mat4.blend(matrix2, widthRatio, heightRatio, zNear, zFar)
// translate position
// mat4.translate(matrix2, translation)
// rotate position
// mat4.rotate(mv, [degToRad(lat), degToRad(lon), 0])
const eye = new Float32Array([translation[0], translation[1], translation[2]])
console.log('eye BEFORE', eye)
// rotate eye
rotateX(eye, degToRad(lat))
rotateY(eye, degToRad(lon))
console.log('eye AFTER', eye)
// mefore creating the pmv matrix, remove translate from mv and grab eye
mv[12] = 0
mv[13] = 0
mv[14] = 0
// multiply by view
mat4.multiply(matrix2, mv)

// now matrix2 is the assumed matrix, eye and point is ready to convert to floats
const eyeX = doubleToFloats(eye[0])
const eyeY = doubleToFloats(eye[1])
const eyeZ = doubleToFloats(eye[2])
const eyeHigh = [eyeX[0], eyeY[0], eyeZ[0]]
const eyeLow = [eyeX[1], eyeY[1], eyeZ[1]]

const pointX = doubleToFloats(point.x)
const pointY = doubleToFloats(point.y)
const pointZ = doubleToFloats(point.z)
const pointHigh = [pointX[0], pointY[0], pointZ[0]]
const pointLow = [pointX[1], pointY[1], pointZ[1]]

// now we project using precision algorithm
const t1 = [pointLow[0] - eyeLow[0], pointLow[1] - eyeLow[1], pointLow[2] - eyeLow[2]]
const e = [t1[0] - pointLow[0], t1[1] - pointLow[1], t1[2] - pointLow[2]]
const t2 = [
  ((-eyeLow[0] - e[0]) + (pointLow[0] - (t1[0] - e[0]))) + pointHigh[0] - eyeHigh[0],
  ((-eyeLow[1] - e[1]) + (pointLow[1] - (t1[1] - e[1]))) + pointHigh[1] - eyeHigh[1],
  ((-eyeLow[2] - e[2]) + (pointLow[2] - (t1[2] - e[2]))) + pointHigh[2] - eyeHigh[2]
]
const highDifference = [t1[0] + t2[0], t1[1] + t2[1], t1[2] + t2[2]]
const lowDifference = [t2[0] - (highDifference[0] - t1[0]), t2[1] - (highDifference[1] - t1[1]), t2[2] - (highDifference[2] - t1[2])]

// const highDifference = [pointHigh[0] - eyeHigh[0], pointHigh[1] - eyeHigh[1], pointHigh[2] - eyeHigh[2]]
// const lowDifference = [pointLow[0] - eyeLow[0], pointLow[1] - eyeLow[1], pointLow[2] - eyeLow[2]]
const difference = [highDifference[0] + lowDifference[0], highDifference[1] + lowDifference[1], highDifference[2] + lowDifference[2]]

const projectedPoint2 = mat4.project(matrix2, difference)
// const projectedPoint2 = mat4.multiplyVector(matrix2, difference)
console.log('**** PRECISION *****')
console.log('mv', mv)
console.log('matrix2', matrix2)
console.log('projection: ', projectedPoint2)
console.log('_____ PRECISION _____')


// function doubleToFloats (val) {
//   let doubleHigh, high, low
//   if (val >= 0) {
//     doubleHigh = Math.floor(val / 65536) * 65536
//     high = Math.fround(doubleHigh)
//     low = Math.fround(val - doubleHigh)
//   } else {
//     doubleHigh = Math.floor(-val / 65536) * 65536
//     high = Math.fround(-doubleHigh)
//     low = Math.fround(val + doubleHigh)
//   }
//
//   return [high, low]
// }

function doubleToFloats (val) {
  const high = Math.fround(val)
  const low = val - high

  return [high, low]
}



function rotateX (vec, rad) {
  vec[0] = vec[0]
  vec[1] = vec[1] * Math.cos(rad) - vec[2] * Math.sin(rad)
  vec[2] = vec[1] * Math.sin(rad) + vec[2] * Math.cos(rad)
}

function rotateY (vec, rad) {
  vec[0] = vec[2] * Math.sin(rad) + vec[0] * Math.cos(rad)
  vec[1] = vec[1]
  vec[2] = vec[2] * Math.cos(rad) - vec[0] * Math.sin(rad)
}

function rotateZ (vec, rad) {
  vec[0] = vec[0] * Math.cos(rad) - vec[1] * Math.sin(rad)
  vec[1] = vec[0] * Math.sin(rad) + vec[1] * Math.cos(rad)
  vec[2] = vec[2]
}
