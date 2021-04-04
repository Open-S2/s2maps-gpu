console.log(lookAt([0, 0, 0], [0, 1, 0]))

function lookAt (eye, up) {
  const m = new Float32Array(16)
  let x0, x1, x2, y0, y1, y2, z0, z1, z2, len
  let eyex = eye[0]
  let eyey = eye[1]
  let eyez = eye[2]
  let upx = up[0]
  let upy = up[1]
  let upz = up[2]

  z0 = eyex
  z1 = eyey
  z2 = eyez
  len = 1 / Math.hypot(z0, z1, z2)
  if (len === Infinity) len = 0
  z0 *= len
  z1 *= len
  z2 *= len
  x0 = upy * z2 - upz * z1
  x1 = upz * z0 - upx * z2
  x2 = upx * z1 - upy * z0
  len = Math.hypot(x0, x1, x2)

  console.log('len', len)

  if (!len) {
    x0 = 0
    x1 = 0
    x2 = 0
  } else {
    len = 1 / len
    x0 *= len
    x1 *= len
    x2 *= len
  }

  y0 = z1 * x2 - z2 * x1
  y1 = z2 * x0 - z0 * x2
  y2 = z0 * x1 - z1 * x0
  len = Math.hypot(y0, y1, y2)

  if (!len) {
    y0 = 0
    y1 = 0
    y2 = 0
  } else {
    len = 1 / len
    y0 *= len
    y1 *= len
    y2 *= len
  }

  m[0] = x0
  m[1] = y0
  m[2] = z0
  m[3] = 0
  m[4] = x1
  m[5] = y1
  m[6] = z1
  m[7] = 0
  m[8] = x2
  m[9] = y2
  m[10] = z2
  m[11] = 0
  m[12] = -(x0 * eyex + x1 * eyey + x2 * eyez)
  m[13] = -(y0 * eyex + y1 * eyey + y2 * eyez)
  m[14] = -(z0 * eyex + z1 * eyey + z2 * eyez)
  m[15] = 1

  return m
}
