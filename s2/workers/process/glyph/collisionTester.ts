import type { Node, RoundNodes, SquareNode } from './glyph.spec.js';

/** Generic compare function */
export type CompareFunction = (a: Node, b: Node) => number;

/**
 * # Collision Tester
 *
 * Due to the nature of tile sizes keeping the quantity of nodes lower,
 * collisions storage is a non-issue. Thus, we can do very basic collision detection tests
 * and not worry about complexity.
 */
export default class CollisionTester {
  nodes: Node[] = [];
  /** Clear all nodes for the next tile */
  clear(): void {
    this.nodes = [];
  }

  /**
   * Insert if and only if there are no collisions with prior nodes
   * If there is a collision, return true
   * @param node - the node to insert
   * @returns true if there is a collision with pre-existing nodes
   */
  collides(node: Node): boolean {
    let collision = false;
    for (const existing of this.nodes) {
      if (this.#collides(node, existing)) {
        collision = true;
        break;
      }
    }
    if (!collision) this.nodes.push(node);
    return collision;
  }

  /**
   * Check if two nodes collide using both square and round node checks
   * @param a - the first node
   * @param b - the second node
   * @returns true if the nodes collide
   */
  #collides(a: Node, b: Node): boolean {
    if (a.id === b.id) return false;
    if ('r' in a && 'r' in b) return this.#collidesRoundRound(a as RoundNodes, b as RoundNodes);
    else if ('r' in a) return this.#collidesRoundSquare(a as RoundNodes, b as SquareNode);
    else if ('r' in b) return this.#collidesRoundSquare(b as RoundNodes, a as SquareNode);
    else return this.#collidesSquareSquare(a as SquareNode, b as SquareNode);
  }

  /**
   * Check if two round nodes collide
   * @param a - the first round node
   * @param b - the second round node
   * @returns true if the nodes collide
   */
  #collidesRoundRound(a: RoundNodes, b: RoundNodes): boolean {
    for (const aNode of a.nodes) {
      for (const bNode of b.nodes) {
        const dx = aNode.x - bNode.x;
        const dy = aNode.y - bNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < aNode.r + bNode.r) return true;
      }
    }
    return false;
  }

  /**
   * Check if a round node collides with a square node
   * @param a - the round node
   * @param b - the square node
   * @returns true if the nodes collide
   */
  #collidesRoundSquare(a: RoundNodes, b: SquareNode): boolean {
    // https://stackoverflow.com/questions/401847/circle-rectangle-collision-detection-intersection
    for (const node of a.nodes) {
      const dx = node.x - Math.max(b.minX, Math.min(node.x, b.maxX));
      const dy = node.y - Math.max(b.minY, Math.min(node.y, b.maxY));
      if (dx * dx + dy * dy < node.r * node.r) return true;
    }
    return false;
  }

  /**
   * Check if two square nodes collide
   * @param a - the first square node
   * @param b - the second square node
   * @returns true if the nodes collide
   */
  #collidesSquareSquare(a: SquareNode, b: SquareNode): boolean {
    return (
      a.id !== b.id && a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
    );
  }
}
