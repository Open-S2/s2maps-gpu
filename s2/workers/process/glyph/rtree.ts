import type { GlyphObject, Node } from './glyph.spec'

export type CompareFunction = (a: Node, b: Node) => number

export default class RTree {
  _maxEntries: number
  _minEntries: number
  root?: Node
  constructor (maxEntries = 7) {
    // max entries in a node is 9 by default; min node fill is 40% for best performance
    this._maxEntries = Math.max(4, maxEntries)
    this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4))
  }

  clear (): void {
    this.root = createNode([])
  }

  compareMinX (a: Node, b: Node): number { return a.minX - b.minX }
  compareMinY (a: Node, b: Node): number { return a.minY - b.minY }

  collides (glyph: GlyphObject): boolean {
    if (this.root === undefined) return false
    let node: undefined | Node = this.root

    if (!intersects(glyph, node)) {
      this.insert(glyph)
      return false
    }

    const nodesToSearch = []
    while (node !== undefined) {
      for (let i = 0; i < node.children.length; i++) {
        const childBBox: undefined | Node = node.children[i]

        if (childBBox !== undefined && intersects(glyph, childBBox)) {
          if (node.leaf || contains(glyph, childBBox)) return true
          nodesToSearch.push(childBBox)
        }
      }
      node = nodesToSearch.pop()
    }

    this.insert(glyph)
    return false
  }

  insert (glyph: Node): RTree {
    this.#insert(glyph, (this.root?.treeHeight ?? 0) - 1)
    return this
  }

  #insert (glyph: Node, level: number): void {
    const insertPath: Node[] = []
    if (this.root === undefined) {
      this.root = createNode([glyph])
      this.root.leaf = false
      return
    }

    // find the best node for accommodating the item, saving all nodes along the path too
    const node = this.#chooseSubtree(glyph, this.root, level, insertPath)
    // put the item into the node
    node.children.push(glyph)
    extend(node, glyph)
    // split on node overflow; propagate upwards if necessary
    while (level >= 0) {
      if (insertPath[level].children.length > this._maxEntries) {
        this.#split(insertPath, level)
        level--
      } else break
    }

    // adjust bboxes along the insertion path
    this._adjustParentBBoxes(glyph, insertPath, level)
  }

  #chooseSubtree (glyph: Node, node: Node, level: number, path: Node[]): Node {
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

      node = targetNode ?? node.children[0]
    }

    return node
  }

  // split overflowed node into two
  #split (insertPath: Node[], level: number): void {
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

    if (level !== 0) insertPath[level - 1].children.push(newNode)
    else this.#splitRoot(node, newNode)
  }

  #splitRoot (node: Node, newNode: Node): void {
    // split root node
    this.root = createNode([node, newNode])
    this.root.treeHeight = node.treeHeight ?? 0 + 1
    this.root.leaf = false
    calcBBox(this.root)
  }

  _chooseSplitIndex (node: Node, m: number, M: number): number {
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

    return index ?? M - m
  }

  // sorts node children by the best axis for split
  _chooseSplitAxis (node: Node, m: number, M: number): void {
    const compareMinX = node.leaf ? this.compareMinX : compareNodeMinX
    const compareMinY = node.leaf ? this.compareMinY : compareNodeMinY
    const xMargin = this._allDistMargin(node, m, M, compareMinX)
    const yMargin = this._allDistMargin(node, m, M, compareMinY)

    // if total distributions margin value is minimal for x, sort by minX,
    // otherwise it's already sorted by minY
    if (xMargin < yMargin) node.children.sort(compareMinX)
  }

  // total margin of all possible split distributions where each node is at least m full
  _allDistMargin (node: Node, m: number, M: number, compare: CompareFunction): number {
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

  _adjustParentBBoxes (glyph: Node, path: Node[], level: number): void {
    // adjust bboxes along the given tree path
    for (let i = level; i >= 0; i--) {
      extend(path[i], glyph)
    }
  }
}

// calculate node's bbox from bboxes of its children
function calcBBox (node: Node): void {
  distBBox(node, 0, node.children.length, node)
}

// min bounding rectangle of node children from k to p-1
function distBBox (node: Node, k: number, p: number, destNode?: Node): Node {
  if (destNode === undefined) destNode = createNode([])
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

function extend (a: Node, b: Node): Node {
  a.minX = Math.min(a.minX, b.minX)
  a.minY = Math.min(a.minY, b.minY)
  a.maxX = Math.max(a.maxX, b.maxX)
  a.maxY = Math.max(a.maxY, b.maxY)

  return a
}

function compareNodeMinX (a: Node, b: Node): number { return a.minX - b.minX }
function compareNodeMinY (a: Node, b: Node): number { return a.minY - b.minY }

function bboxArea (a: Node): number { return (a.maxX - a.minX) * (a.maxY - a.minY) }
function bboxMargin (a: Node): number { return (a.maxX - a.minX) + (a.maxY - a.minY) }

function enlargedArea (a: Node, b: Node): number {
  return (Math.max(b.maxX, a.maxX) - Math.min(b.minX, a.minX)) *
    (Math.max(b.maxY, a.maxY) - Math.min(b.minY, a.minY))
}

function intersectionArea (a: Node, b: Node): number {
  const minX = Math.max(a.minX, b.minX)
  const minY = Math.max(a.minY, b.minY)
  const maxX = Math.min(a.maxX, b.maxX)
  const maxY = Math.min(a.maxY, b.maxY)

  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY)
}

function contains (a: Node, b: Node): boolean {
  return a.minX <= b.minX && a.minY <= b.minY && b.maxX <= a.maxX && b.maxY <= a.maxY
}

function intersects (a: Node, b: Node): boolean {
  return b.minX <= a.maxX && b.minY <= a.maxY && b.maxX >= a.minX && b.maxY >= a.minY
}

function createNode (children: Node[]): Node {
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
