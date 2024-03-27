import type { Node, RoundNodes, SquareNode } from './glyph.spec'

export type CompareFunction = (a: Node, b: Node) => number

export default class CollisionTester {
  nodes: Node[] = []
  clear (): void {
    this.nodes = []
  }

  /**
   * Insert if and only if there are no collisions with prior nodes
   * If there is a collision, return true
   */
  collides (node: Node): boolean {
    let collision = false
    for (const existing of this.nodes) {
      if (this.#collides(node, existing)) {
        collision = true
        break
      }
    }
    if (!collision) this.nodes.push(node)
    return collision
  }

  #collides (a: Node, b: Node): boolean {
    if ('r' in a && 'r' in b) return this.#collidesRoundRound(a as RoundNodes, b as RoundNodes)
    else if ('r' in a) return this.#collidesRoundSquare(a as RoundNodes, b as SquareNode)
    else if ('r' in b) return this.#collidesRoundSquare(b as RoundNodes, a as SquareNode)
    else return this.#collidesSquareSquare(a as SquareNode, b as SquareNode)
  }

  #collidesRoundRound (a: RoundNodes, b: RoundNodes): boolean {
    for (const aNode of a.nodes) {
      for (const bNode of b.nodes) {
        if (aNode.id === bNode.id) continue
        const dx = aNode.x - bNode.x
        const dy = aNode.y - bNode.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance < aNode.r + bNode.r) return true
      }
    }
    return false
  }

  #collidesRoundSquare (a: RoundNodes, b: SquareNode): boolean {
    // https://stackoverflow.com/questions/401847/circle-rectangle-collision-detection-intersection
    for (const node of a.nodes) {
      if (node.id === b.id) continue
      const dx = node.x - Math.max(b.minX, Math.min(node.x, b.maxX))
      const dy = node.y - Math.max(b.minY, Math.min(node.y, b.maxY))
      if ((dx * dx) + (dy * dy) < node.r * node.r) return true
    }
    return false
  }

  #collidesSquareSquare (a: SquareNode, b: SquareNode): boolean {
    return a.id !== b.id &&
      a.minX < b.maxX &&
      a.maxX > b.minX &&
      a.minY < b.maxY &&
      a.maxY > b.minY
  }
}
