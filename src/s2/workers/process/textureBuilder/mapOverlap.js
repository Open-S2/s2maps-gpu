// @flow
export type Quad = {
  s: number,
  t: number,
  width: number,
  height: number,
  key?: number,
  left?: number,
  right?: number
}

export default class MapOverlap {
  root: null | Quad = null
  scale: number = 1
  constructor (scale?: number) {
    if (scale) this.scale = scale
  }

  clear () {
    this.root = null
  }

  testQuad (quad: Quad): boolean {
    let evenOdd, node, less, leftRight

    if (isNaN(quad.s) || isNaN(quad.t)) return false
    // first quad
    if (!this.root) {
      quad.key = quad.s
      this.root = quad
      return true
    }
    // traverse the rtree
    node = this.root
    evenOdd = false
    while (true) {
      evenOdd = !evenOdd
      // always check overlap first
      if (this.isOverlap(node, quad)) return true
      // work down the tree, if no left or no right, just store and return no overlap,
      // otherwise update node and continue
      less = (evenOdd ? quad.s : quad.t) < node.key
      leftRight = less ? node.left : node.right
      if (leftRight) {
        node = leftRight
      } else {
        quad.key = evenOdd ? quad.t : quad.s
        if (less) node.left = quad
        else node.right = quad
        return false
      }
    }
  }

  // if quad has an align, check.
  isOverlap (ref: Quad, val: Quad) {
    const { scale } = this
    let s, t
    // setup rectangles [left, bottom, right, top]
    // ref
    const [refOffsetS, refOffsetT] = offsets(ref)
    s = (ref.s * scale) | 0
    t = (ref.t * scale) | 0
    const a = [s + refOffsetS, t + refOffsetT, s + ref.width + refOffsetS, t + ref.height + refOffsetT]
    // val
    const [valOffsetS, valOffsetT] = offsets(val)
    s = (val.s * scale) | 0
    t = (val.t * scale) | 0
    const b = [s + valOffsetS, t + valOffsetT, s + val.width + valOffsetS, t + val.height + valOffsetT]
    // check overlap
    return !(a[0] > b[2]) && !(a[2] < b[0]) && !(a[1] > b[3]) && !(a[3] < b[1])
  }
}

function offsets (val) {
  const { anchor, width, height } = val
  if (!anchor) return [0, 0]
  else if (anchor === 0) return [-width / 2, -height / 2]
  else if (anchor === 1) return [-width, -height / 2]
  else if (anchor === 2) return [-width, 0]
  else if (anchor === 3) return [-width / 2, 0]
  else if (anchor === 4) return [0, 0]
  else if (anchor === 5) return [0, -height / 2]
  else if (anchor === 6) return [0, -height]
  else if (anchor === 7) return [-width / 2, -height]
  else if (anchor === 8) return [-width, -height]
  else return [0, 0]
}
