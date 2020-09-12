// @flow
import type { GlyphObject } from '../glyph'

export type Node = { // $FlowIgnore
  children: Array<Node | GlyphObject>,
  treeHeight: number,
  leaf: boolean,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
}

export default class RTree {
  _maxEntries: number
  _minEntries: number
  root: Node
  constructor (maxEntries: number = 7) {
    // max entries in a node is 9 by default; min node fill is 40% for best performance
    this._maxEntries = Math.max(4, maxEntries)
    this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4))
    this.clear()
  }

  clear () {
    this.root = createNode([])
  }

  compareMinX (a: GlyphObject | Node, b: GlyphObject | Node): number { return a.minX - b.minX }
  compareMinY (a: GlyphObject | Node, b: GlyphObject | Node): number { return a.minY - b.minY }

  collides (glyph: GlyphObject) {
    let node: Node | GlyphObject = this.root

    if (!node || !intersects(glyph, node)) {
      this.insert(glyph)
      return false
    }

    const nodesToSearch = []
    while (node) {
      for (let i = 0; i < node.children.length; i++) {
        const childBBox = node.children[i]

        if (childBBox && intersects(glyph, childBBox)) {
          if (node.leaf || contains(glyph, childBBox)) return true
          nodesToSearch.push(childBBox)
        }
      }
      node = nodesToSearch.pop()
    }

    this.insert(glyph)
    return false
  }

  insert (glyph: GlyphObject) {
    this._insert(glyph, this.root.treeHeight - 1)
    return this
  }

  _insert (glyph: GlyphObject, level: number) {
    const insertPath = []

    // find the best node for accommodating the item, saving all nodes along the path too
    const node = this._chooseSubtree(glyph, this.root, level, insertPath)
    // put the item into the node
    node.children.push(glyph)
    extend(node, glyph)
    // split on node overflow; propagate upwards if necessary
    while (level >= 0) {
      if (insertPath[level].children.length > this._maxEntries) {
        this._split(insertPath, level)
        level--
      } else break
    }

    // adjust bboxes along the insertion path
    this._adjustParentBBoxes(glyph, insertPath, level)
  }

  _chooseSubtree (glyph: GlyphObject, node: Node | GlyphObject, level: number, path: Array<Node | GlyphObject>): Node | GlyphObject {
    while (true) {
      path.push(node)

      if (node.leaf || path.length - 1 === level) break

      let minArea = Infinity
      let minEnlargement = Infinity
      let targetNode

      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        const area = bboxArea(child)
        const enlargement = enlargedArea(glyph, child) - area

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

  // split overflowed node into two
  _split (insertPath: Array<Node | GlyphObject>, level: number) {
    const node = insertPath[level]
    const M = node.children.length
    const m = this._minEntries

    this._chooseSplitAxis(node, m, M)

    const splitIndex: number = this._chooseSplitIndex(node, m, M)

    const newNode = createNode(node.children.splice(splitIndex, node.children.length - splitIndex))
    newNode.treeHeight = node.treeHeight
    newNode.leaf = node.leaf

    calcBBox(node)
    calcBBox(newNode)

    if (level) insertPath[level - 1].children.push(newNode)
    else this._splitRoot(node, newNode)
  }

  _splitRoot (node: Node | GlyphObject, newNode: Node) {
    // split root node
    this.root = createNode([node, newNode])
    this.root.treeHeight = node.treeHeight + 1
    this.root.leaf = false
    calcBBox(this.root)
  }

  _chooseSplitIndex (node: Node | GlyphObject, m: number, M: number): number {
    let index
    let minOverlap = Infinity
    let minArea = Infinity

    for (let i = m; i <= M - m; i++) {
      const bbox1 = distBBox(node, 0, i)
      const bbox2 = distBBox(node, i, M)

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
  _chooseSplitAxis (node: Node | GlyphObject, m: number, M: number) {
    const compareMinX = node.leaf ? this.compareMinX : compareNodeMinX
    const compareMinY = node.leaf ? this.compareMinY : compareNodeMinY
    const xMargin = this._allDistMargin(node, m, M, compareMinX)
    const yMargin = this._allDistMargin(node, m, M, compareMinY)

    // if total distributions margin value is minimal for x, sort by minX,
    // otherwise it's already sorted by minY
    if (xMargin < yMargin) node.children.sort(compareMinX)
  }

  // total margin of all possible split distributions where each node is at least m full
  _allDistMargin (node: Node | GlyphObject, m: number, M: number, compare: Function) {
    node.children.sort(compare)

    const leftBBox = distBBox(node, 0, m)
    const rightBBox = distBBox(node, M - m, M)
    let margin = bboxMargin(leftBBox) + bboxMargin(rightBBox)

    for (let i = m; i < M - m; i++) {
      const child = node.children[i]
      extend(leftBBox, child)
      margin += bboxMargin(leftBBox)
    }

    for (let i = M - m - 1; i >= m; i--) {
      const child = node.children[i]
      extend(rightBBox, child)
      margin += bboxMargin(rightBBox)
    }

    return margin
  }

  _adjustParentBBoxes (glyph: GlyphObject, path: Array<Node | GlyphObject>, level: number) {
    // adjust bboxes along the given tree path
    for (let i = level; i >= 0; i--) {
      extend(path[i], glyph)
    }
  }
}

// calculate node's bbox from bboxes of its children
function calcBBox (node) {
  distBBox(node, 0, node.children.length, node)
}

// min bounding rectangle of node children from k to p-1
function distBBox (node, k, p, destNode) {
  if (!destNode) destNode = createNode([])
  destNode.minX = Infinity
  destNode.minY = Infinity
  destNode.maxX = -Infinity
  destNode.maxY = -Infinity

  for (let i = k; i < p; i++) {
    const child = node.children[i]
    extend(destNode, child)
  }

  return destNode
}

function extend (a: GlyphObject | Node, b: GlyphObject | Node) {
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

function intersects (a: GlyphObject | Node, b: GlyphObject | Node) {
  return b.minX <= a.maxX && b.minY <= a.maxY && b.maxX >= a.minX && b.maxY >= a.minY
}

function createNode (children: Array<Node | GlyphObject>): Node {
  return {
    children,
    treeHeight: 1,
    leaf: true,
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  }
}
