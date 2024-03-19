import {
  children,
  contains,
  fromID,
  isFace,
  isOutOfBounds,
  level,
  neighborsXY,
  parent,
  tileIDWrapped,
  toID,
  toIJ,
  zagzig,
  zigzag
} from 'geometry/wm/mercID'
import { describe, expect, it, test } from 'bun:test'

describe('managing tile x-y-z to/from ID', () => {
  it('toID', () => {
    expect(toID(0, 0, 0)).toEqual(0n)
    expect(toID(1, 0, 0)).toEqual(1n)
  })

  it('fromID', () => {
    expect(fromID(0n)).toEqual([0, 0, 0])
    expect(fromID(1n)).toEqual([1, 0, 0])
  })

  it('toID and fromID random', () => {
    expect(fromID(toID(0, 0, 0))).toEqual([0, 0, 0])
    expect(fromID(toID(1, 0, 0))).toEqual([1, 0, 0])
    expect(fromID(toID(1, 1, 0))).toEqual([1, 1, 0])
    expect(fromID(toID(1, 1, 1))).toEqual([1, 1, 1])
    expect(fromID(toID(20, 1048575, 1048575))).toEqual([20, 1048575, 1048575])
    expect(fromID(toID(29, (1 << 29) - 1, (1 << 29) - 1))).toEqual([29, (1 << 29) - 1, (1 << 29) - 1])
    expect(fromID(toID(30, (1 << 30) - 1, (1 << 30) - 1))).toEqual([30, (1 << 30) - 1, (1 << 30) - 1])
  })

  it('toID and fromID out of bounds tiles', () => {
    expect(fromID(toID(0, 1, 0))).toEqual([0, 1, 0])
    expect(fromID(toID(0, 2, 0))).toEqual([0, 2, 0])
    expect(fromID(toID(0, 3, 0))).toEqual([0, 3, 0])
    expect(fromID(toID(0, 4, 0))).toEqual([0, 4, 0])
    expect(fromID(toID(0, -1, 0))).toEqual([0, -1, 0])
    expect(fromID(toID(1, -1, 0))).toEqual([1, -1, 0])
    expect(fromID(toID(1, -2, 0))).toEqual([1, -2, 0])
    expect(fromID(toID(1, -3, 0))).toEqual([1, -3, 0])
    expect(fromID(toID(4, -1, 7))).toEqual([4, -1, 7])
    expect(fromID(toID(20, -1048575, 1000))).toEqual([20, -1048575, 1000])
  })
})

test('toID and fromID for all zooms 1-7', () => {
  const idCache = new Set()
  for (let z = 1; z <= 7; z++) {
    for (let x = 0; x < 2 ** z; x++) {
      for (let y = 0; y < 2 ** z; y++) {
        const id = toID(z, x, y)
        if (idCache.has(id)) throw new Error(`duplicate id ${id}`)
        idCache.add(id)
        expect(fromID(id)).toEqual([z, x, y])
      }
    }
  }
})

describe('create children for various zooms', () => {
  it('zoom 0', () => {
    expect(children(0n)).toEqual([
      1n,
      33n,
      65n,
      97n
    ])
  })
  it('zoom 1', () => {
    expect(children(1n)).toEqual([
      2n,
      34n,
      130n,
      162n
    ])
  })
  it('zoom 2', () => {
    expect(children(2n)).toEqual([
      3n,
      35n,
      259n,
      291n
    ])
  })
})

describe('various neighborsXY', () => {
  it('zoom 0', () => {
    expect(neighborsXY(0, 0, 0)).toEqual([
    ])
  })

  it('zoom 1', () => {
    expect(neighborsXY(1, 0, 0)).toEqual([
      [1, 1, 0],
      [1, 0, 1]
    ])
  })

  it('zoom 1 at the end', () => {
    expect(neighborsXY(1, 1, 1)).toEqual([
      [1, 0, 1],
      [1, 1, 0]
    ])
  })

  it('zoom 2', () => {
    expect(neighborsXY(2, 0, 0)).toEqual([
      [2, 1, 0],
      [2, 0, 1]
    ])
  })

  it('zoom 2 in the middle', () => {
    expect(neighborsXY(2, 1, 1)).toEqual([
      [2, 0, 1],
      [2, 2, 1],
      [2, 1, 0],
      [2, 1, 2]
    ])
  })
})

describe('various neighborsXY with includeOutOfBounds', () => {
  it('zoom 0', () => {
    expect(neighborsXY(0, 0, 0, true)).toEqual([
      [0, -1, 0],
      [0, 1, 0]
    ])
    expect(neighborsXY(0, -1, 0, true)).toEqual([
      [0, -2, 0],
      [0, 0, 0]
    ])
  })
})

describe('tileIDWrapped', () => {
  it('zoom 0', () => {
    expect(tileIDWrapped(toID(0, 0, 0))).toEqual(toID(0, 0, 0))
    expect(tileIDWrapped(toID(0, 1, 0))).toEqual(toID(0, 0, 0))
    expect(tileIDWrapped(toID(0, 2, 0))).toEqual(toID(0, 0, 0))
    expect(tileIDWrapped(toID(0, 3, 0))).toEqual(toID(0, 0, 0))
    expect(tileIDWrapped(toID(0, 4, 0))).toEqual(toID(0, 0, 0))
    expect(tileIDWrapped(toID(0, -1, 0))).toEqual(toID(0, 0, 0))
  })

  it('zoom 1', () => {
    expect(tileIDWrapped(toID(1, 0, 0))).toEqual(toID(1, 0, 0))
    expect(tileIDWrapped(toID(1, 1, 0))).toEqual(toID(1, 1, 0))
    expect(tileIDWrapped(toID(1, -1, 0))).toEqual(toID(1, 1, 0))
  })

  it('zoom 2', () => {
    expect(tileIDWrapped(toID(2, 0, 0))).toEqual(toID(2, 0, 0))
    expect(tileIDWrapped(toID(2, 1, 0))).toEqual(toID(2, 1, 0))
    expect(tileIDWrapped(toID(2, -1, 0))).toEqual(toID(2, 3, 0))
  })
})

describe('isOutOfBounds', () => {
  it('zoom 0', () => {
    expect(isOutOfBounds(toID(0, 0, 0))).toEqual(false)
    expect(isOutOfBounds(toID(0, 1, 0))).toEqual(true)
    expect(isOutOfBounds(toID(0, 2, 0))).toEqual(true)
  })

  it('zoom 1', () => {
    expect(isOutOfBounds(toID(1, 0, 0))).toEqual(false)
    expect(isOutOfBounds(toID(1, 1, 0))).toEqual(false)
    expect(isOutOfBounds(toID(1, -1, 0))).toEqual(true)
  })

  it('zoom 2', () => {
    expect(isOutOfBounds(toID(2, 0, 0))).toEqual(false)
    expect(isOutOfBounds(toID(2, 1, 0))).toEqual(false)
    expect(isOutOfBounds(toID(2, -1, 0))).toEqual(true)
    expect(isOutOfBounds(toID(2, 1, 1))).toEqual(false)
    expect(isOutOfBounds(toID(2, 3, 0))).toEqual(false)
    expect(isOutOfBounds(toID(2, 4, 0))).toEqual(true)
  })
})

describe('parent', () => {
  it('zoom 0', () => {
    expect(parent(0n)).toEqual(-1n)
  })

  it('zoom 1', () => {
    const id = toID(1, 0, 0)
    expect(parent(id)).toEqual(toID(0, 0, 0))
  })

  it('zoom 2', () => {
    const id = toID(2, 0, 0)
    expect(parent(id)).toEqual(toID(1, 0, 0))
  })

  it('zoom 2 in the middle', () => {
    const id = toID(2, 1, 1)
    expect(parent(id)).toEqual(1n)
  })

  it('zoom 10', () => {
    const id = toID(10, 0, 0)
    expect(parent(id)).toEqual(toID(9, 0, 0))
  })
})

describe('toIJ', () => {
  it('zoom 0', () => {
    const id = toID(0, 0, 0)
    expect(toIJ(id)).toEqual([0, 0, 0])
  })

  it('zoom 1', () => {
    const id = toID(1, 0, 0)
    expect(toIJ(id)).toEqual([1, 0, 0])
    // to zoom 0
    expect(toIJ(id, 0)).toEqual([0, 0, 0])
  })

  it('zoom 10', () => {
    const id = toID(10, 20, 20)
    expect(toIJ(id)).toEqual([10, 20, 20])
    // to zoom 0
    expect(toIJ(id, 0)).toEqual([0, 0, 0])
    // to zoom 1
    expect(toIJ(id, 1)).toEqual([1, 0, 0])
    // to zoom 5
    expect(toIJ(id, 5)).toEqual([5, 0, 0])
    // to zoom 8
    expect(toIJ(id, 8)).toEqual([8, 5, 5])
    // to zoom 9
    expect(toIJ(id, 9)).toEqual([9, 10, 10])
  })
})

describe('contains', () => {
  it('parent zoom 0 should always be true', () => {
    const parentID = toID(0, 0, 0)
    expect(contains(parentID, toID(1, 0, 0))).toEqual(true)
    expect(contains(parentID, toID(1, 1, 0))).toEqual(true)
    expect(contains(parentID, toID(1, 0, 1))).toEqual(true)
    expect(contains(parentID, toID(1, 1, 1))).toEqual(true)
    // zoom 5
    expect(contains(parentID, toID(5, 0, 0))).toEqual(true)
    expect(contains(parentID, toID(5, 1, 0))).toEqual(true)
    // zoom 10
    expect(contains(parentID, toID(10, 100, 100))).toEqual(true)
  })

  it('parent zoom 2', () => {
    const parentID = toID(2, 0, 0)
    expect(contains(parentID, toID(3, 0, 0))).toEqual(true)
    expect(contains(parentID, toID(3, 1, 0))).toEqual(true)
    expect(contains(parentID, toID(3, 0, 1))).toEqual(true)
    expect(contains(parentID, toID(3, 4, 1))).toEqual(false)
    // zoom 5
    expect(contains(parentID, toID(5, 0, 0))).toEqual(true)
    expect(contains(parentID, toID(5, 16, 0))).toEqual(false)
    // zoom 10
    expect(contains(parentID, toID(10, 500, 100))).toEqual(false)
  })
})

test('isFace', () => {
  expect(isFace(0n)).toEqual(true)
  expect(isFace(1n)).toEqual(false)
})

test('level', () => {
  expect(level(0n)).toEqual(0)
  expect(level(1n)).toEqual(1)
  expect(level(2n)).toEqual(2)
  expect(level(toID(10, 0, 0))).toEqual(10)
  expect(level(toID(10, 500, 100))).toEqual(10)
  expect(level(toID(29, (1 << 29) - 1, (1 << 29) - 1))).toEqual(29)
  expect(level(toID(30, (1 << 30) - 1, (1 << 30) - 1))).toEqual(30)
})

describe('zigzag & zagzig', () => {
  test('zigzag', () => {
    // positives
    expect(zigzag(0)).toEqual(0)
    expect(zigzag(1)).toEqual(2)
    expect(zigzag(2)).toEqual(4)
    expect(zigzag(3)).toEqual(6)
    expect(zigzag(4)).toEqual(8)
    expect(zigzag(100000000)).toEqual(200000000)
    // negatives
    expect(zigzag(-1)).toEqual(1)
    expect(zigzag(-2)).toEqual(3)
    expect(zigzag(-3)).toEqual(5)
    expect(zigzag(-4)).toEqual(7)
    expect(zigzag(-100000000)).toEqual(199999999)
  })
  test('zagzig', () => {
    // positives
    expect(zagzig(0)).toEqual(0)
    expect(zagzig(2)).toEqual(1)
    expect(zagzig(4)).toEqual(2)
    expect(zagzig(6)).toEqual(3)
    expect(zagzig(8)).toEqual(4)
    expect(zagzig(200000000)).toEqual(100000000)
    // negatives
    expect(zagzig(1)).toEqual(-1)
    expect(zagzig(3)).toEqual(-2)
    expect(zagzig(5)).toEqual(-3)
    expect(zagzig(7)).toEqual(-4)
    expect(zagzig(199999999)).toEqual(-100000000)
  })
  test('zigzag & zagzig', () => {
    for (let i = -1_000_000; i < 1_000_000; i++) {
      expect(zagzig(zigzag(i))).toEqual(i)
    }
  })
})
