import earcut from './earcut'

export function earclip (polygon, modulo = Infinity, offset = 0) {
  if (!modulo) modulo = Infinity
  // Use earcut to build standard triangle set
  const { vertices, holeIndices, dim } = flatten(polygon) // dim => dimensions
  const indices = earcut(vertices, holeIndices, dim)
  // tesselate if necessary
  tesselate(vertices, indices, modulo, dim)
  // update offset and return
  return { vertices, indices: indices.map(index => index + offset) }
}

export function tesselate (vertices, indices, modulo, dim) {
  // for each triangle, ensure each triangle line does not pass through iterations of the modulo for x, y, and z
  if (modulo !== Infinity) {
    let A, B, C
    for (let axis = 0; axis < dim; axis++) {
      for (let i = 0; i < indices.length; i += 3) {
        // get indexes of each vertex
        A = indices[i]
        B = indices[i + 1]
        C = indices[i + 2]
        const triangle = splitIfNecessary(A, B, C, vertices, indices, dim, axis, modulo)
        if (triangle) {
          indices[i] = triangle[0]
          indices[i + 1] = triangle[1]
          indices[i + 2] = triangle[2]
          i -= 3
        }
      }
    }
  }
}

// given vertices, and an axis of said vertices:
// find a number "x" that is x % modulo === 0 and between v1 and v2
function splitIfNecessary (i1, i2, i3, vertices, indices, dim, axis, modulo) {
  const v1 = vertices[i1 * dim + axis]
  const v2 = vertices[i2 * dim + axis]
  const v3 = vertices[i3 * dim + axis]
  // 1 is corner
  if (v1 < v2 && v1 < v3) {
    const modPoint = v1 + modulo - mod2(v1, modulo)
    if (modPoint > v1 && modPoint <= v2 && modPoint <= v3 && (v2 !== modPoint || v2 !== modPoint)) {
      return splitRight(modPoint, i1, i2, i3, v1, v2, v3, vertices, indices, dim, axis, modulo)
    }
  } else if (v1 > v2 && v1 > v3) {
    let mod = mod2(v1, modulo)
    if (!mod) mod = modulo
    const modPoint = v1 - mod
    if (modPoint < v1 && modPoint >= v2 && modPoint >= v3 && (v2 !== modPoint || v2 !== modPoint)) {
      return splitLeft(modPoint, i1, i2, i3, v1, v2, v3, vertices, indices, dim, axis, modulo)
    }
  }
  // 2 is corner
  if (v2 < v1 && v2 < v3) {
    const modPoint = v2 + modulo - mod2(v2, modulo)
    if (modPoint > v2 && modPoint <= v3 && modPoint <= v1 && (v1 !== modPoint || v3 !== modPoint)) {
      return splitRight(modPoint, i2, i3, i1, v2, v3, v1, vertices, indices, dim, axis, modulo)
    }
  } else if (v2 > v1 && v2 > v3) {
    let mod = mod2(v2, modulo)
    if (!mod) mod = modulo
    const modPoint = v2 - mod
    if (modPoint < v2 && modPoint >= v3 && modPoint >= v1 && (v1 !== modPoint || v3 !== modPoint)) {
      return splitLeft(modPoint, i2, i3, i1, v2, v3, v1, vertices, indices, dim, axis, modulo)
    }
  }
  // 3 is corner
  if (v3 < v1 && v3 < v2) {
    const modPoint = v3 + modulo - mod2(v3, modulo)
    if (modPoint > v3 && modPoint <= v1 && modPoint <= v2 && (v1 !== modPoint || v2 !== modPoint)) {
      return splitRight(modPoint, i3, i1, i2, v3, v1, v2, vertices, indices, dim, axis, modulo)
    }
  } else if (v3 > v1 && v3 > v2) {
    let mod = mod2(v3, modulo)
    if (!mod) mod = modulo
    const modPoint = v3 - mod
    if (modPoint < v3 && modPoint >= v1 && modPoint >= v2 && (v1 !== modPoint || v2 !== modPoint)) {
      return splitLeft(modPoint, i3, i1, i2, v3, v1, v2, vertices, indices, dim, axis, modulo)
    }
  }
}

function createVertex (splitPoint, i1, i2, v1, v2, vertices, dim, axis) {
  const index = vertices.length / dim
  const travelDivisor = (v2 - v1) / (splitPoint - v1)
  let va1, va2
  for (let i = 0; i < dim; i++) {
    va1 = vertices[i1 * dim + i]
    va2 = vertices[i2 * dim + i]
    if (i !== axis) vertices.push(va1 + ((va2 - va1) / travelDivisor))
    else vertices.push(splitPoint)
  }
  return index
}

// i1 is always the vertex with an acute angle.
// splitRight means we start on the left side of this "1D" observation moving right
function splitRight (modPoint, i1, i2, i3, v1, v2, v3, vertices, indices, dim, axis, modulo) {
  // first case is a standalone triangle
  let i12 = createVertex(modPoint, i1, i2, v1, v2, vertices, dim, axis)
  let i13 = createVertex(modPoint, i1, i3, v1, v3, vertices, dim, axis)
  indices.push(i1, i12, i13)
  modPoint += modulo
  if (v2 < v3) {
    // create lines up to i2
    while (modPoint < v2) {
      // next triangles are i13->i12->nexti13 and nexti13->i12->nexti12 so store in necessary order
      indices.push(i13, i12)
      i13 = createVertex(modPoint, i1, i3, v1, v3, vertices, dim, axis)
      indices.push(i13, i13, i12)
      i12 = createVertex(modPoint, i1, i2, v1, v2, vertices, dim, axis)
      indices.push(i12)
      // increment
      modPoint += modulo
    }
    // add v2 triangle if necessary
    indices.push(i13, i12, i2)
    // return the remaining triangle
    return [i13, i2, i3]
  } else {
    // create lines up to i2
    while (modPoint < v3) {
      // next triangles are i13->i12->nexti13 and nexti13->i12->nexti12 so store in necessary order
      indices.push(i13, i12)
      i13 = createVertex(modPoint, i1, i3, v1, v3, vertices, dim, axis)
      indices.push(i13, i13, i12)
      i12 = createVertex(modPoint, i1, i2, v1, v2, vertices, dim, axis)
      indices.push(i12)
      // increment
      modPoint += modulo
    }
    // add v3 triangle if necessary
    indices.push(i13, i12, i3)
    // return the remaining triangle
    return [i3, i12, i2]
  }
}

// i1 is always the vertex with an acute angle. i2 is always the furthest away from i1
// splitLeft means we start on the right side of this "1D" observation moving left
function splitLeft (modPoint, i1, i2, i3, v1, v2, v3, vertices, indices, dim, axis, modulo) {
  // first case is a standalone triangle
  let i12 = createVertex(modPoint, i1, i2, v1, v2, vertices, dim, axis)
  let i13 = createVertex(modPoint, i1, i3, v1, v3, vertices, dim, axis)
  indices.push(i1, i12, i13)
  modPoint -= modulo
  if (v2 > v3) {
    // create lines up to i2
    while (modPoint > v2) {
      // next triangles are i13->i12->nexti13 and nexti13->i12->nexti12 so store in necessary order
      indices.push(i13, i12)
      i13 = createVertex(modPoint, i1, i3, v1, v3, vertices, dim, axis)
      indices.push(i13, i13, i12)
      i12 = createVertex(modPoint, i1, i2, v1, v2, vertices, dim, axis)
      indices.push(i12)
      // increment
      modPoint -= modulo
    }
    // add v2 triangle if necessary
    indices.push(i13, i12, i2)
    // return the remaining triangle
    return [i13, i2, i3]
  } else {
    // create lines up to i2
    while (modPoint > v3) {
      // next triangles are i13->i12->nexti13 and nexti13->i12->nexti12 so store in necessary order
      indices.push(i13, i12)
      i13 = createVertex(modPoint, i1, i3, v1, v3, vertices, dim, axis)
      indices.push(i13, i13, i12)
      i12 = createVertex(modPoint, i1, i2, v1, v2, vertices, dim, axis)
      indices.push(i12)
      // increment
      modPoint -= modulo
    }
    // add v3 triangle if necessary
    indices.push(i13, i12, i3)
    // return the remaining triangle
    return [i3, i12, i2]
  }
}

function mod2 (x, n) {
  return ((x % n) + n) % n
}

export function flatten (data) {
  let holeIndex = 0
  const vertices = []
  const holeIndices = []

  for (let i = 0, pl = data.length; i < pl; i++) {
    for (let j = 0, ll = data[i].length; j < ll; j++) vertices.push(...data[i][j])
    if (i > 0) {
      holeIndex += data[i - 1].length
      holeIndices.push(holeIndex)
    }
  }
  return { vertices, holeIndices, dim: data[0][0].length }
}
