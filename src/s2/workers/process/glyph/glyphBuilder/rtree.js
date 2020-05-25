// @flow
export type Quad = {
  s: number,
  t: number,
  width: number,
  height: number
}

export default class RTree {
  constructor (maxEntries = 7) {
    // max entries in a node is 9 by default; min node fill is 40% for best performance
    this._maxEntries = Math.max(4, maxEntries)
    this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4))
    this.clear()
  }

  collides (bbox) {
    let node = this.data

    if (!intersects(bbox, node)) {
      this.insert(bbox)
      return false
    }

    const nodesToSearch = []
    while (node) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        const childBBox = node.leaf ? this.toBBox(child) : child

        if (intersects(bbox, childBBox)) {
          if (node.leaf || contains(bbox, childBBox)) return true
          nodesToSearch.push(child)
        }
      }
      node = nodesToSearch.pop()
    }

    this.insert(bbox)
    return false
  }

  insert (item) {
    if (item) this._insert(item, this.data.height - 1)
    return this
  }

  clear () {
    this.data = createNode([])
    return this
  }

  toBBox (item) { return item }

  compareMinX (a, b) { return a.minX - b.minX }
  compareMinY (a, b) { return a.minY - b.minY }

  _chooseSubtree (bbox, node, level, path) {
    while (true) {
      path.push(node)

      if (node.leaf || path.length - 1 === level) break

      let minArea = Infinity
      let minEnlargement = Infinity
      let targetNode

      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        const area = bboxArea(child)
        const enlargement = enlargedArea(bbox, child) - area

        // choose entry with the least area enlargement
        if (enlargement < minEnlargement) {
          minEnlargement = enlargement
          minArea = area < minArea ? area : minArea
          targetNode = child
        } else if (enlargement === minEnlargement) {
          // otherwise choose one with the smallest area
          if (area < minArea) {
            minArea = area
            targetNode = child
          }
        }
      }

      node = targetNode || node.children[0]
    }

    return node
  }

  _insert (item, level, isNode) {
    const bbox = isNode ? item : this.toBBox(item)
    const insertPath = []

    // find the best node for accommodating the item, saving all nodes along the path too
    const node = this._chooseSubtree(bbox, this.data, level, insertPath)

    // put the item into the node
    node.children.push(item)
    extend(node, bbox)

    // split on node overflow; propagate upwards if necessary
    while (level >= 0) {
      if (insertPath[level].children.length > this._maxEntries) {
        this._split(insertPath, level)
        level--
      } else break
    }

    // adjust bboxes along the insertion path
    this._adjustParentBBoxes(bbox, insertPath, level)
  }

  // split overflowed node into two
  _split (insertPath, level) {
    const node = insertPath[level]
    const M = node.children.length
    const m = this._minEntries

    this._chooseSplitAxis(node, m, M)

    const splitIndex = this._chooseSplitIndex(node, m, M)

    const newNode = createNode(node.children.splice(splitIndex, node.children.length - splitIndex))
    newNode.height = node.height
    newNode.leaf = node.leaf

    calcBBox(node, this.toBBox)
    calcBBox(newNode, this.toBBox)

    if (level) insertPath[level - 1].children.push(newNode)
    else this._splitRoot(node, newNode)
  }

  _splitRoot (node, newNode) {
    // split root node
    this.data = createNode([node, newNode])
    this.data.height = node.height + 1
    this.data.leaf = false
    calcBBox(this.data, this.toBBox)
  }

  _chooseSplitIndex (node, m, M) {
    let index
    let minOverlap = Infinity
    let minArea = Infinity

    for (let i = m; i <= M - m; i++) {
      const bbox1 = distBBox(node, 0, i, this.toBBox)
      const bbox2 = distBBox(node, i, M, this.toBBox)

      const overlap = intersectionArea(bbox1, bbox2)
      const area = bboxArea(bbox1) + bboxArea(bbox2)

      // choose distribution with minimum overlap
      if (overlap < minOverlap) {
        minOverlap = overlap
        index = i

        minArea = area < minArea ? area : minArea
      } else if (overlap === minOverlap) {
        // otherwise choose distribution with minimum area
        if (area < minArea) {
          minArea = area
          index = i
        }
      }
    }

    return index || M - m
  }

  // sorts node children by the best axis for split
  _chooseSplitAxis (node, m, M) {
    const compareMinX = node.leaf ? this.compareMinX : compareNodeMinX
    const compareMinY = node.leaf ? this.compareMinY : compareNodeMinY
    const xMargin = this._allDistMargin(node, m, M, compareMinX)
    const yMargin = this._allDistMargin(node, m, M, compareMinY)

    // if total distributions margin value is minimal for x, sort by minX,
    // otherwise it's already sorted by minY
    if (xMargin < yMargin) node.children.sort(compareMinX)
  }

  // total margin of all possible split distributions where each node is at least m full
  _allDistMargin (node, m, M, compare) {
    node.children.sort(compare)

    const toBBox = this.toBBox
    const leftBBox = distBBox(node, 0, m, toBBox)
    const rightBBox = distBBox(node, M - m, M, toBBox)
    let margin = bboxMargin(leftBBox) + bboxMargin(rightBBox)

    for (let i = m; i < M - m; i++) {
      const child = node.children[i]
      extend(leftBBox, node.leaf ? toBBox(child) : child)
      margin += bboxMargin(leftBBox)
    }

    for (let i = M - m - 1; i >= m; i--) {
      const child = node.children[i]
      extend(rightBBox, node.leaf ? toBBox(child) : child)
      margin += bboxMargin(rightBBox)
    }

    return margin
  }

  _adjustParentBBoxes (bbox, path, level) {
    // adjust bboxes along the given tree path
    for (let i = level; i >= 0; i--) {
      extend(path[i], bbox)
    }
  }

  _condense (path) {
    // go through the path, removing empty nodes and updating bboxes
    for (let i = path.length - 1, siblings; i >= 0; i--) {
      if (path[i].children.length === 0) {
        if (i > 0) {
          siblings = path[i - 1].children
          siblings.splice(siblings.indexOf(path[i]), 1)
        } else this.clear()
      } else calcBBox(path[i], this.toBBox)
    }
  }
}

function findItem (item, items, equalsFn) {
  if (!equalsFn) return items.indexOf(item)

  for (let i = 0; i < items.length; i++) {
    if (equalsFn(item, items[i])) return i
  }
  return -1
}

// calculate node's bbox from bboxes of its children
function calcBBox (node, toBBox) {
  distBBox(node, 0, node.children.length, toBBox, node)
}

// min bounding rectangle of node children from k to p-1
function distBBox (node, k, p, toBBox, destNode) {
  if (!destNode) destNode = createNode(null)
  destNode.minX = Infinity
  destNode.minY = Infinity
  destNode.maxX = -Infinity
  destNode.maxY = -Infinity

  for (let i = k; i < p; i++) {
    const child = node.children[i]
    extend(destNode, node.leaf ? toBBox(child) : child)
  }

  return destNode
}

function extend (a, b) {
  a.minX = Math.min(a.minX, b.minX)
  a.minY = Math.min(a.minY, b.minY)
  a.maxX = Math.max(a.maxX, b.maxX)
  a.maxY = Math.max(a.maxY, b.maxY)
  return a
}

function compareNodeMinX (a, b) { return a.minX - b.minX }
function compareNodeMinY (a, b) { return a.minY - b.minY }

function bboxArea (a) { return (a.maxX - a.minX) * (a.maxY - a.minY) }
function bboxMargin (a) { return (a.maxX - a.minX) + (a.maxY - a.minY) }

function enlargedArea (a, b) {
  return (Math.max(b.maxX, a.maxX) - Math.min(b.minX, a.minX)) *
    (Math.max(b.maxY, a.maxY) - Math.min(b.minY, a.minY))
}

function intersectionArea (a, b) {
  const minX = Math.max(a.minX, b.minX)
  const minY = Math.max(a.minY, b.minY)
  const maxX = Math.min(a.maxX, b.maxX)
  const maxY = Math.min(a.maxY, b.maxY)

  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY)
}

function contains (a, b) {
  return a.minX <= b.minX && a.minY <= b.minY && b.maxX <= a.maxX && b.maxY <= a.maxY
}

function intersects (a, b) {
  return b.minX <= a.maxX && b.minY <= a.maxY && b.maxX >= a.minX && b.maxY >= a.minY
}

function createNode (children) {
  return {
    children,
    height: 1,
    leaf: true,
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  }
}
