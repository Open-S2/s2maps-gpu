import type { XYZ } from 'geometry'

export function create (): Float32Array {
  const m = new Float32Array(16)
  m[0] = 1
  m[5] = 1
  m[10] = 1
  m[15] = 1

  return m
}

export function clone (m: Float32Array): Float32Array {
  const out = new Float32Array(m.length)

  m.forEach((v, i) => { out[i] = v })

  return out
}

export function blend (
  m: Float32Array,
  width: number,
  height: number,
  near: number,
  far: number
): Float32Array {
  m[0] = 1 / width
  m[1] = 0
  m[2] = 0
  m[3] = 0
  m[4] = 0
  m[5] = 1 / height
  m[6] = 0
  m[7] = 0
  m[8] = 0
  m[9] = 0
  m[11] = -1
  m[12] = 0
  m[13] = 0
  m[15] = 0
  if (far !== null && far !== Infinity) {
    const nf = 1 / (near - far)
    m[10] = (far + near) * nf
    m[14] = (2 * far * near) * nf
  } else {
    m[10] = -1
    m[14] = -2 * near
  }

  return m
}

export function ortho (
  m: Float32Array,
  width: number,
  height: number,
  far: number
): Float32Array {
  m[0] = 1 / width
  m[1] = 0
  m[2] = 0
  m[3] = 0
  m[4] = 0
  m[5] = 1 / height
  m[6] = 0
  m[7] = 0
  m[8] = 0
  m[9] = 0
  m[10] = -1 / far
  m[11] = 0
  m[12] = 0
  m[13] = 0
  m[14] = 0
  m[15] = 1

  return m
}

export function perspective (
  m: Float32Array,
  fovy: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1.0 / Math.tan(fovy / 2)
  m[0] = f / aspect
  m[1] = 0
  m[2] = 0
  m[3] = 0
  m[4] = 0
  m[5] = f
  m[6] = 0
  m[7] = 0
  m[8] = 0
  m[9] = 0
  m[11] = -1
  m[12] = 0
  m[13] = 0
  m[15] = 0
  if (far != null && far !== Infinity) {
    const nf = 1 / (near - far)
    m[10] = (far + near) * nf
    m[14] = (2 * far * near) * nf
  } else {
    m[10] = -1
    m[14] = -2 * near
  }

  return m
}

export function lookAt (
  eye: XYZ,
  up: XYZ
): Float32Array {
  const m = new Float32Array(16)
  let x0: number, x1: number, x2: number, y0: number, y1: number
  let y2: number, z0: number, z1: number, z2: number, len: number
  const eyex = eye[0]
  const eyey = eye[1]
  const eyez = eye[2]
  const upx = up[0]
  const upy = up[1]
  const upz = up[2]

  z0 = eyex
  z1 = eyey
  z2 = eyez
  len = 1 / Math.hypot(z0, z1, z2)
  z0 *= len
  z1 *= len
  z2 *= len
  x0 = upy * z2 - upz * z1
  x1 = upz * z0 - upx * z2
  x2 = upx * z1 - upy * z0
  len = Math.hypot(x0, x1, x2)

  if (len === 0) {
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

  if (len === 0) {
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

export function addCenter (m: Float32Array, v: Float32Array): Float32Array {
  m[12] = v[0]
  m[13] = v[1]
  m[14] = v[2]
  m[15] = v[3]

  return m
}

export function translate (
  m: Float32Array,
  v: Float32Array | XYZ
): Float32Array {
  const x = v[0]; const y = v[1]; const z = v[2]

  m[12] = m[0] * x + m[4] * y + m[8] * z + m[12]
  m[13] = m[1] * x + m[5] * y + m[9] * z + m[13]
  m[14] = m[2] * x + m[6] * y + m[10] * z + m[14]
  m[15] = m[3] * x + m[7] * y + m[11] * z + m[15]

  return m
}

export function scale (
  m: Float32Array,
  v: Float32Array | XYZ
): Float32Array {
  const x = v[0]
  const y = v[1]
  const z = v[2]

  m[0] = m[0] * x
  m[1] = m[1] * x
  m[2] = m[2] * x
  m[3] = m[3] * x
  m[4] = m[4] * y
  m[5] = m[5] * y
  m[6] = m[6] * y
  m[7] = m[7] * y
  m[8] = m[8] * z
  m[9] = m[9] * z
  m[10] = m[10] * z
  m[11] = m[11] * z

  return m
}

export function rotate (
  m: Float32Array,
  rad: XYZ
): Float32Array {
  rotateX(m, rad[0])
  rotateY(m, rad[1])
  rotateZ(m, rad[2])

  return m
}

export function rotateX (
  m: Float32Array,
  rad: number
): Float32Array {
  const s = Math.sin(rad)
  const c = Math.cos(rad)
  const m10 = m[4]
  const m11 = m[5]
  const m12 = m[6]
  const m13 = m[7]
  const m20 = m[8]
  const m21 = m[9]
  const m22 = m[10]
  const m23 = m[11]
  // Perform axis-specific matrix multiplication
  m[4] = m10 * c + m20 * s
  m[5] = m11 * c + m21 * s
  m[6] = m12 * c + m22 * s
  m[7] = m13 * c + m23 * s
  m[8] = m20 * c - m10 * s
  m[9] = m21 * c - m11 * s
  m[10] = m22 * c - m12 * s
  m[11] = m23 * c - m13 * s

  return m
}

export function rotateY (m: Float32Array, rad: number): Float32Array {
  const s = Math.sin(rad)
  const c = Math.cos(rad)
  const m00 = m[0]
  const m01 = m[1]
  const m02 = m[2]
  const m03 = m[3]
  const m20 = m[8]
  const m21 = m[9]
  const m22 = m[10]
  const m23 = m[11]
  // Perform axis-specific matrix multiplication
  m[0] = m00 * c - m20 * s
  m[1] = m01 * c - m21 * s
  m[2] = m02 * c - m22 * s
  m[3] = m03 * c - m23 * s
  m[8] = m00 * s + m20 * c
  m[9] = m01 * s + m21 * c
  m[10] = m02 * s + m22 * c
  m[11] = m03 * s + m23 * c

  return m
}

export function rotateZ (m: Float32Array, rad: number): Float32Array {
  const s = Math.sin(rad)
  const c = Math.cos(rad)
  const m00 = m[0]
  const m01 = m[1]
  const m02 = m[2]
  const m03 = m[3]
  const m10 = m[4]
  const m11 = m[5]
  const m12 = m[6]
  const m13 = m[7]
  // Perform axis-specific matrix multiplication
  m[0] = m00 * c + m10 * s
  m[1] = m01 * c + m11 * s
  m[2] = m02 * c + m12 * s
  m[3] = m03 * c + m13 * s
  m[4] = m10 * c - m00 * s
  m[5] = m11 * c - m01 * s
  m[6] = m12 * c - m02 * s
  m[7] = m13 * c - m03 * s

  return m
}

export function multiplyVector (
  m: Float32Array,
  v: XYZ
): number[] {
  const out: number[] = []

  out.push(m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12])
  out.push(m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13])
  out.push(m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14])
  out.push(m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15])

  return out
}

export function multiply (
  a: Float32Array,
  b: Float32Array | number[]
): Float32Array {
  const a00 = a[0]
  const a01 = a[1]
  const a02 = a[2]
  const a03 = a[3]
  const a10 = a[4]
  const a11 = a[5]
  const a12 = a[6]
  const a13 = a[7]
  const a20 = a[8]
  const a21 = a[9]
  const a22 = a[10]
  const a23 = a[11]
  const a30 = a[12]
  const a31 = a[13]
  const a32 = a[14]
  const a33 = a[15]
  // Cache only the current line of the second matrix
  let b0 = b[0]
  let b1 = b[1]
  let b2 = b[2]
  let b3 = b[3]
  a[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
  a[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
  a[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
  a[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
  b0 = b[4]
  b1 = b[5]
  b2 = b[6]
  b3 = b[7]
  a[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
  a[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
  a[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
  a[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
  b0 = b[8]
  b1 = b[9]
  b2 = b[10]
  b3 = b[11]
  a[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
  a[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
  a[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
  a[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
  b0 = b[12]
  b1 = b[13]
  b2 = b[14]
  b3 = b[15]
  a[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
  a[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
  a[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
  a[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

  return a
}

export function invert (matrix: Float32Array): null | Float32Array {
  const a00 = matrix[0]; const a01 = matrix[1]; const a02 = matrix[2]; const a03 = matrix[3]; const a10 = matrix[4]; const a11 = matrix[5]
  const a12 = matrix[6]; const a13 = matrix[7]; const a20 = matrix[8]; const a21 = matrix[9]; const a22 = matrix[10]; const a23 = matrix[11]
  const a30 = matrix[12]; const a31 = matrix[13]; const a32 = matrix[14]; const a33 = matrix[15]

  const b00 = a00 * a11 - a01 * a10
  const b01 = a00 * a12 - a02 * a10
  const b02 = a00 * a13 - a03 * a10
  const b03 = a01 * a12 - a02 * a11
  const b04 = a01 * a13 - a03 * a11
  const b05 = a02 * a13 - a03 * a12
  const b06 = a20 * a31 - a21 * a30
  const b07 = a20 * a32 - a22 * a30
  const b08 = a20 * a33 - a23 * a30
  const b09 = a21 * a32 - a22 * a31
  const b10 = a21 * a33 - a23 * a31
  const b11 = a22 * a33 - a23 * a32
  // Calculate the determinant
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
  if (det === 0) return null

  det = 1 / det
  matrix[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det
  matrix[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det
  matrix[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det
  matrix[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det
  matrix[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det
  matrix[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det
  matrix[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det
  matrix[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det
  matrix[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det
  matrix[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det
  matrix[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det
  matrix[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det
  matrix[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det
  matrix[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det
  matrix[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det
  matrix[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det

  return matrix
}

export function project (
  matrix: Float32Array,
  vector: XYZ
): XYZ {
  const mul = multiplyVector(matrix, vector)

  return [mul[0] / mul[3], mul[1] / mul[3], mul[2] / mul[3]]
}
