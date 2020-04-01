function mapOverlap (quads) { // { x: number, y: number, width: number, height: number }
  let root = null
  let evenOdd, node, less, leftRight

  for (const quad of quads) {
    if (!quad.x || !quad.y) continue
    // first quad
    if (!root) {
      quad.overlap = false
      quad.key = quad.x
      root = quad
      continue
    }
    // traverse the rtree
    node = root
    evenOdd = false
    while (true) {
      evenOdd = !evenOdd
      // always check overlap first
      if (isOverlap(node, quad)) {
        quad.overlap = true
        break
      }
      // work down the tree, if no left or no right, just store,
      // otherwise update node and continue
      less = (evenOdd ? quad.x : quad.y) < node.key
      leftRight = less ? node.left : node.right
      if (leftRight) {
        node = leftRight
      } else {
        // store
        quad.overlap = false
        quad.key = evenOdd ? quad.y : quad.x
        if (less) node.left = quad
        else node.right = quad
        break
      }
    }
  }
}

// if quad has an align, check.
function isOverlap (ref, val) {
  // setup rectangles [left, bottom, right, top]
  let offsetX, offsetY
  // ref
  [offsetX, offsetY] = offsets(ref)
  const a = [ref.x + offsetX, ref.y + offsetY, ref.x + ref.width + offsetX, ref.y + ref.width + offsetY]
  // val
  [offsetX, offsetY] = offsets(val)
  const b = [val.x + offsetX, val.y + offsetY, val.x + val.width + offsetX, val.y + val.width + offsetY]
  // check overlap
  if (a[0] < b[2] && a[2] > b[0] && a[4] > b[1] && a[1] < b[4]) return true
  return false
}

function offsets (val) {
  const { align, width, height } = val
  if (!align) return [0, 0]
  else if (align === 'center') return [-width / 2, -height / 2]
  else if (align === 'left') return [-width, -height / 2]
  else if (align === 'topLeft') return [-width, 0]
  else if (align === 'top') return [-width / 2, 0]
  else if (align === 'topRight') return [0, 0]
  else if (align === 'right') return [0, -height / 2]
  else if (align === 'bottomRight') return [0, -height]
  else if (align === 'bottom') return [-width / 2, -height]
  else if (align === 'bottomLeft') return [-width, -height]
  else return [0, 0]
}
