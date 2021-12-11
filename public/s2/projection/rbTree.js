// @flow

export class Node {
  key: BigInt
  value: any
  left: Node
  right: Node
  parent: Node
  red: boolean = true
  constructor (key: BigInt, value: any, sentinel: null | Node) {
    this.key = key
    this.value = value
    this.left = sentinel
    this.right = sentinel
  }
}

export default class RBTree {
  root: null | Node
  sentinel: Node
  count: number = 0
  constructor () {
    this.root = this.sentinel = new Node(null, null, null)
  }
  insert (key: BigInt, value: any) {
    if (typeof key !== 'bigint') return
    const node = new Node(key, value, this.sentinel)

    let y = this.sentinel
    let x = this.root
    while (x.key) {
      y = x
      if (key < x.key) x = x.left
      else x = x.right
    }
    node.parent = y
    if (!y.key) this.root = node // tree was empty
    else if (key < y.key) y.left = node
    else y.right = node
    this._insert(node)

    this.count++
  }

  // balance post insert
  _insert (node: Node) {
    while (node.parent && node.parent.parent && node.parent.red) {
      if (node.parent === node.parent.parent.left) {
        const uncle = node.parent.parent.right
        if (uncle.red) {
          node.parent.red = false
          uncle.red = false
          node = node.parent.parent
          node.red = true
        } else {
          if (node === node.parent.right) {
            node = node.parent
            this._leftRotate(node)
          }
          node.parent.red = false
          node.parent.parent.red = true
          this._rightRotate(node.parent.parent)
        }
      }
      else if (node.parent === node.parent.parent.right) {
        const uncle = node.parent.parent.left
        if (uncle.red) {
          node.parent.red = false
          uncle.red = false
          node = node.parent.parent
          node.red = true
        }
        else {
          if (node === node.parent.left) {
            node = node.parent
            this._rightRotate(node)
          }
          node.parent.red = false
          node.parent.parent.red = true
          this._leftRotate(node.parent.parent)
        }
      }
    }
    this.root.red = false
  }

  _leftRotate (node: Node) {
    let y = node.right
    node.right = y.left
    if (y.left.key !== null) y.left.parent = node
    y.parent = node.parent
    if (!node.parent.key) this.root = y
    else if (node === node.parent.left) node.parent.left = y
    else node.parent.right = y
    y.left = node
    node.parent = y
  }

  _rightRotate (node: Node) {
    let y = node.left
    node.left = y.right
    if (y.right.key !== null) y.right.parent = node
    y.parent = node.parent
    if (!node.parent.key) this.root = y
    else if (node === node.parent.right) node.parent.right = y
    else node.parent.left = y
    y.right = node
    node.parent = y
  }

  delete (key: BigInt): boolean {
    const node = this._get(key)
    if (!node) return false
    this.count--
    const { parent } = node
    if (parent.key && node.key < parent.key) parent.left = null
    else parent.right = null
    return true
  }

  get (key: BigInt): null | any {
    const node = this._get(key)
    return node.key !== null ? node.value : null
  }

  _get (key: BigInt): null | Node {
    let node = this.root

    while (node.key !== null && key !== node.key) {
      if (key < node.key) node = node.left
      else node = node.right
    }

    return node
  }

  has (key: BigInt): boolean {
    const node = this._get(key)

    if (node.key) return true
    else return false
  }

  iterate = function * () {
    let node = this.min()
    if (!node) return

    do {
      yield [node.key, node.value]
      node = this.next(node)
    } while (node)
  }

  min (node: Node = this.root) {
    while (node.left && node.left.key !== null) node = node.left

    return node
  }

  max (node: Node = this.root) {
    while (node.right && node.right.key !== null) node = node.right

    return node
  }

  next (node: Node) {
    node = (node.right.key)
      ? this.min(node.right)
      : (node.parent.key > node.key)
        ? node.parent
        : null

    if (!node || node.key === null) return null
    else return node
  }

  range (min: BigInt, max: BigInt) {
    const res = []

    let node = this.root
    if (!node.key) return res

    // find smallest possible value
    let lower
    while (true) {
      lower = node.left
      if (lower.key !== null && lower.key >= min) node = lower
      else if (lower.right && lower.right.key !== null && lower.right.key >= min) node = lower.right
      else break
    }

    do {
      res.push([node.key, node.value])
      node = this.next(node)
    } while (node && node.key <= max)

    return res
  }

  rangeGen = function * (min: BigInt, max: BigInt) {
    let node = this.root
    if (!node.key || min === undefined || max === undefined) return

    // find smallest possible value
    let lower
    while (true) {
      lower = node.left
      if (lower.key !== null && lower.key >= min) node = lower
      else if (lower.right && lower.right.key !== null && lower.right.key >= min) node = lower.right
      else break
    }

    do {
      yield [node.key, node.value]
      node = this.next(node)
    } while (node && node.key <= max)
  }
}
