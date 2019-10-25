// @flow
export function create (): Float32Array {
  const m = new Float32Array(16)

  return m
}

export function clone (m: Float32Array): Float32Array {
  const out = new Float32Array(m.length)

  m.forEach((v, i) => out[i] = v)

  return out
}

export function blend (m: Float32Array, width: number, height: number, near: number, far: number): Float32Array {
  // const f = 1.0 / Math.tan(fovy / 2)
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
  if (far != null && far !== Infinity) {
    let nf = 1 / (near - far)
    m[10] = (far + near) * nf
    m[14] = (2 * far * near) * nf
  } else {
    m[10] = -1
    m[14] = -2 * near
  }

  return m
}

export function ortho (m: Float32Array, width: number, height: number, far: number): Float32Array {
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
  m[14] = -1
  m[15] = 1

  return m
}

export function perspective (m: Float32Array, fovy: number, aspect: number, near: number, far: number): Float32Array {
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
    let nf = 1 / (near - far)
    m[10] = (far + near) * nf
    m[14] = (2 * far * near) * nf
  } else {
    m[10] = -1
    m[14] = -2 * near
  }

  return m
}

export function addCenter (m: Float32Array, v: Float32Array | Array<number>): Float32Array {
  m[12] = v[0]
  m[13] = v[1]
  m[14] = v[2]
  m[15] = v[3]

  return m
}

export function translate (m: Float32Array, v: Float32Array | [number, number, number]): Float32Array {
  const x = v[0], y = v[1], z = v[2]

  m[12] = m[0] * x + m[4] * y + m[8] * z + m[12]
  m[13] = m[1] * x + m[5] * y + m[9] * z + m[13]
  m[14] = m[2] * x + m[6] * y + m[10] * z + m[14]
  m[15] = m[3] * x + m[7] * y + m[11] * z + m[15]

  return m
}

export function scale(m: Float32Array, v: Float32Array | [number, number, number]): Float32Array {
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

export function rotate (m: Float32Array, rad: [number, number, number]): Float32Array {
  rotateX(m, rad[0])
  rotateY(m, rad[1])
  rotateZ(m, rad[2])

  return m
}

export function rotateX (m: Float32Array, rad: number): Float32Array {
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

export function multiplyVector (a: Float32Array | Array<number>, b: Float32Array | Array<number>): Array<number> {
  const out = []

  // out.push(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])
  // out.push(a[4] * b[0] + a[5] * b[1] + a[6] * b[2] + a[7] * b[3])
  // out.push(a[8] * b[0] + a[9] * b[1] + a[10] * b[2] + a[11] * b[3])
  // out.push(a[12] * b[0] + a[13] * b[1] + a[14] * b[2] + a[15] * b[3])

  out.push(a[0] * b[0] + a[4] * b[1] + a[8] * b[2] + a[12] * b[3])
  out.push(a[1] * b[0] + a[5] * b[1] + a[9] * b[2] + a[13] * b[3])
  out.push(a[2] * b[0] + a[6] * b[1] + a[10] * b[2] + a[14] * b[3])
  out.push(a[3] * b[0] + a[7] * b[1] + a[11] * b[2] + a[15] * b[3])

  return out
}

export function multiply (a: Float32Array | Array<number>, b: Float32Array | Array<number>): Float32Array | Array<number> {
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
  a[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30
  a[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31
  a[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32
  a[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33
  b0 = b[4]
  b1 = b[5]
  b2 = b[6]
  b3 = b[7]
  a[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30
  a[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31
  a[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32
  a[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33
  b0 = b[8]
  b1 = b[9]
  b2 = b[10]
  b3 = b[11]
  a[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30
  a[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31
  a[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32
  a[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33
  b0 = b[12]
  b1 = b[13]
  b2 = b[14]
  b3 = b[15]
  a[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30
  a[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31
  a[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32
  a[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33

  return a
}
