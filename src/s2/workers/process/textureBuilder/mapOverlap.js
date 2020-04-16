// @flow
export default function mapOverlap (quads, scale = 1) { // { s: number, t: number, width: number, height: number }
  let root = null
  let evenOdd, node, less, leftRight

  for (const quad of quads) {
    if (isNaN(quad.s) || isNaN(quad.t)) continue
    // first quad
    if (!root) {
      quad.overlap = false
      quad.key = quad.s
      root = quad
      continue
    }
    // traverse the rtree
    node = root
    evenOdd = false
    while (true) {
      evenOdd = !evenOdd
      // always check overlap first
      if (isOverlap(node, quad, scale)) {
        quad.overlap = true
        break
      }
      // work down the tree, if no left or no right, just store,
      // otherwise update node and continue
      less = (evenOdd ? quad.s : quad.t) < node.key
      leftRight = less ? node.left : node.right
      if (leftRight) {
        node = leftRight
      } else {
        // store
        quad.overlap = false
        quad.key = evenOdd ? quad.t : quad.s
        if (less) node.left = quad
        else node.right = quad
        break
      }
    }
  }

  return quads
}

// if quad has an align, check.
function isOverlap (ref, val, scale) {
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
