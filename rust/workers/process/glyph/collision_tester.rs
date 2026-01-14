use crate::workers::{Node, RoundNodes, SquareNode};
use alloc::{vec, vec::Vec};
use libm::{fmax, fmin, sqrt};

/// Generic compare function
pub type CompareFunction = fn(a: &Node, b: &Node) -> bool;

/// # Collision Tester
///
/// Due to the nature of tile sizes keeping the quantity of nodes lower,
/// collisions storage is a non-issue. Thus, we can do very basic collision detection tests
/// and not worry about complexity.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct CollisionTester {
    /// The list of nodes we are tracking
    pub nodes: Vec<Node>,
}
impl CollisionTester {
    /// Clear all nodes for the next tile
    pub fn clear(&mut self) {
        self.nodes = vec![];
    }

    /**
     * Insert if and only if there are no collisions with prior nodes
     * If there is a collision, return true
     * @param node - the node to insert
     * @returns true if there is a collision with pre-existing nodes
     */
    pub fn collides(&mut self, node: &Node) -> bool {
        let mut collision = false;
        for existing in &self.nodes {
            if node.collision(existing) {
                collision = true;
                break;
            }
        }
        if !collision {
            self.nodes.push(node.clone());
        }

        collision
    }
}

impl Node {
    /**
     * Check if two nodes collide using both square and round node checks
     * @param a - the first node
     * @param b - the second node
     * @returns true if the nodes collide
     */
    pub fn collision(&self, b: &Node) -> bool {
        match (self, b) {
            (Node::Round(a), Node::Round(b)) => collides_round_round(a, b),
            (Node::Round(a), Node::Square(b)) => collides_round_square(a, b),
            (Node::Square(a), Node::Round(b)) => collides_round_square(b, a),
            (Node::Square(a), Node::Square(b)) => collides_square_square(a, b),
        }
    }
}

/**
 * Check if two round nodes collide
 * @param a - the first round node
 * @param b - the second round node
 * @returns true if the nodes collide
 */
fn collides_round_round(a: &RoundNodes, b: &RoundNodes) -> bool {
    for a_node in &a.nodes {
        for b_bode in &b.nodes {
            let dx = a_node.x - b_bode.x;
            let dy = a_node.y - b_bode.y;
            let distance = sqrt(dx * dx + dy * dy);
            if distance < a_node.r + b_bode.r {
                return true;
            }
        }
    }
    false
}

/**
 * Check if a round node collides with a square node
 * @param a - the round node
 * @param b - the square node
 * @returns true if the nodes collide
 */
fn collides_round_square(a: &RoundNodes, b: &SquareNode) -> bool {
    // https://stackoverflow.com/questions/401847/circle-rectangle-collision-detection-intersection
    for node in &a.nodes {
        let dx = node.x - fmax(b.min_x, fmin(node.x, b.max_x));
        let dy = node.y - fmax(b.min_y, fmin(node.y, b.max_y));
        if dx * dx + dy * dy < node.r * node.r {
            return true;
        }
    }
    false
}

/**
 * Check if two square nodes collide
 * @param a - the first square node
 * @param b - the second square node
 * @returns true if the nodes collide
 */
fn collides_square_square(a: &SquareNode, b: &SquareNode) -> bool {
    a.id != b.id && a.min_x < b.max_x && a.max_x > b.min_x && a.min_y < b.max_y && a.max_y > b.min_y
}
