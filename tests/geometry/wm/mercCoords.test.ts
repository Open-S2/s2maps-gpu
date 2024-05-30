import {
  altitudeFromMercatorZ,
  bboxToXYZBounds,
  convert,
  latFromMercatorY,
  llToMerc,
  llToPX,
  llToTile,
  llToTilePx,
  lngFromMercatorX,
  mercToLL,
  mercatorLatScale,
  mercatorXfromLng,
  mercatorYfromLat,
  mercatorZfromAltitude,
  pxToLL,
  pxToTile,
  tilePxBounds,
  xyzToBBOX
} from 'geometry/wm/mercCoords'
import { describe, expect, it, test } from 'bun:test'

import type { BBox } from 'geometry'

describe('llToPX', () => {
  it('PX with int zoom value converts when antiMeridian=true', () => {
    expect(llToPX({ x: -179, y: 85 }, 9, true, 256)).toEqual({ x: 364.0888888888876, y: 214.68476683766494 })
  })

  it('PX with int zoom value converts when antiMeridian=false', () => {
    expect(llToPX({ x: -179, y: 85 }, 9, false, 256)).toEqual({ x: 364.0888888888876, y: 214.68476683766494 })
  })

  it('PX with float zoom value converts when antiMeridian=false', () => {
    expect(llToPX({ x: -179, y: 85 }, 8.6574, false, 256)).toEqual({ x: 287.12734093961626, y: 169.30444219392666 })
  })

  it('PX with float zoom value converts when antiMeridian=true', () => {
    expect(llToPX({ x: -179, y: 85 }, 8.6574, true, 256)).toEqual({ x: 287.12734093961626, y: 169.30444219392666 })
  })

  it('Clamps PX by default when lon >180 when antiMeridian=false', () => {
    expect(llToPX({ x: 250, y: 3 }, 4, false, 256)).toEqual({ x: 4096, y: 2013.8510595566413 })
  })

  it('PX with lon > 180 converts when antimeridian=true', () => {
    expect(llToPX({ x: 250, y: 3 }, 4, true, 256)).toEqual({ x: 4892.444444444444, y: 2013.8510595566413 })
  })

  it('Clamps PX when lon >360 and antimeridian=true', () => {
    expect(llToPX({ x: 400, y: 3 }, 4, true, 256)).toEqual({ x: 6599.111111111111, y: 2013.8510595566413 })
  })

  it('Clamps PX when lon >360 and antimeridian=false', () => {
    expect(llToPX({ x: 400, y: 3 }, 4, false, 256)).toEqual({ x: 4096, y: 2013.8510595566413 })
  })
})

describe('pxToLL', () => {
  it('LL with int zoom value converts', () => {
    expect(pxToLL({ x: 200, y: 200 }, 9, 256)).toEqual({ x: -179.45068359375, y: 85.00351401304401 })
  })

  it('LL with float zoom value converts', () => {
    expect(pxToLL({ x: 200, y: 200 }, 8.6574, 256)).toEqual({ x: -179.3034449476476, y: 84.99067388699072 })
  })
})

describe('xyzToBBOX', () => {
  it('[0,0,0] converted to proper bbox.', () => {
    expect(xyzToBBOX(0, 0, 0, true, 'WGS84', 256)).toEqual([-180, -85.05112877980659, 180, 85.05112877980659])
  })

  it('[0,0,0] converted to proper bbox. source=900913', () => {
    expect(xyzToBBOX(0, 0, 0, true, '900913', 256)).toEqual([-20037508.34278924, -20037508.342789236, 20037508.34278924, 20037508.342789244])
  })

  it('[0,0,1] converted to proper bbox.', () => {
    expect(xyzToBBOX(0, 0, 1, true, 'WGS84', 256)).toEqual([-180, -85.05112877980659, 0, 0])
  })

  it('[0,0,1] converted to proper bbox. source=900913', () => {
    expect(xyzToBBOX(0, 0, 1, true, '900913', 256)).toEqual([-20037508.34278924, -20037508.342789236, 0, -0.0000000007081154551613622])
  })
})

describe('bboxToXYZBounds', () => {
  it('World extents converted to proper tile ranges.', () => {
    expect(bboxToXYZBounds([-180, -85.05112877980659, 180, 85.0511287798066], 0, true, 'WGS84', 256)).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 })
  })

  it('World extents converted to proper tile ranges. source=900913', () => {
    expect(bboxToXYZBounds([-180, -85.05112877980659, 180, 85.0511287798066], 0, true, '900913', 256)).toEqual({ minX: 0, minY: -1, maxX: 0, maxY: 0 })
  })

  it('SW converted to proper tile ranges.', () => {
    expect(bboxToXYZBounds([-180, -85.05112877980659, 0, 0], 1, true, 'WGS84', 256)).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 })
  })

  it('SW converted to proper tile ranges. source=900913', () => {
    expect(bboxToXYZBounds([-180, -85.05112877980659, 0, 0], 1, true, '900913', 256)).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 1 })
  })

  it('broken case', () => {
    const extent: BBox = [-0.087891, 40.95703, 0.087891, 41.044916]
    const xyz = bboxToXYZBounds(extent, 3, true, 'WGS84', 256)
    expect(xyz.minX <= xyz.maxX).toBe(true)
    expect(xyz.minY <= xyz.maxY).toBe(true)
  })

  it('negative case', () => {
    const extent: BBox = [-112.5, 85.0511, -112.5, 85.0511]
    const xyz = bboxToXYZBounds(extent, 0, true, 'WGS84', 256)
    expect(xyz.minY).toBe(0)
  })

  it('fuzz', () => {
    const { max, min } = Math
    for (let i = 0; i < 1000; i++) {
      const x = [-180 + (360 * Math.random()), -180 + (360 * Math.random())]
      const y = [-85 + (170 * Math.random()), -85 + (170 * Math.random())]
      const z = Math.floor(22 * Math.random())
      const extent: BBox = [
        min(...x),
        min(...y),
        max(...x),
        max(...y)
      ]
      const xyz = bboxToXYZBounds(extent, z, true, 'WGS84', 256)
      expect(xyz.minX <= xyz.maxX).toBe(true)
      expect(xyz.minY <= xyz.maxY).toBe(true)
    }
  })
})

describe('convert', () => {
  it('extremes', () => {
    expect(convert([-20037508.342789244, -20037508.342789244, 20037508.342789244, 20037508.342789244], 'WGS84'))
      .toEqual([-180.00000000000003, -85.05112877980659, 180.00000000000003, 85.05112877980659])
    expect(convert([-180, -85.05112877980659, 180, 85.05112877980659], '900913'))
      .toEqual([-20037508.34278924, -20037508.342789236, 20037508.34278924, 20037508.342789244])
    expect(convert([-20037508.34278924, -20037508.34278924, 20037508.34278924, 20037508.342789244], 'WGS84'))
      .toEqual([-179.99999999999997, -85.05112877980659, 179.99999999999997, 85.05112877980659])
  })

  it('extents', () => {
    expect(convert([-240, -90, 240, 90], '900913'))
      .toEqual([-20037508.342789244, -20037508.342789244, 20037508.342789244, 20037508.342789244])

    expect(bboxToXYZBounds([-240, -90, 240, 90], 4, true, 'WGS84', 256))
      .toEqual({ minX: 0, minY: 0, maxX: 15, maxY: 15 })
  })
})

test('high precision float 256', () => {
  let withInt = pxToLL({ x: 200, y: 200 }, 4, 256)
  let withFloat = pxToLL({ x: 200, y: 200 }, 4.0000000001, 256)

  function round (val: number): number {
    return +parseFloat(String(val)).toFixed(6)
  }

  expect(round(withInt.x)).toEqual(round(withFloat.x))
  expect(round(withInt.y)).toEqual(round(withFloat.y))

  // utilize cache
  withInt = pxToLL({ x: 200, y: 200 }, 4, 256)
  withFloat = pxToLL({ x: 200, y: 200 }, 4.0000000001, 256)

  expect(round(withInt.x)).toEqual(round(withFloat.x))
  expect(round(withInt.y)).toEqual(round(withFloat.y))
})

test('high precision float 512', () => {
  let withInt = pxToLL({ x: 400, y: 400 }, 2, 512)
  let withFloat = pxToLL({ x: 400, y: 400 }, 2.00000000001, 512)

  function round (val: number): number {
    return +parseFloat(String(val)).toFixed(6)
  }

  expect(round(withInt.x)).toEqual(round(withFloat.x))
  expect(round(withInt.y)).toEqual(round(withFloat.y))

  // utilize cache
  withInt = pxToLL({ x: 200, y: 200 }, 4, 512)
  withFloat = pxToLL({ x: 200, y: 200 }, 4.0000000001, 512)

  expect(round(withInt.x)).toEqual(round(withFloat.x))
  expect(round(withInt.y)).toEqual(round(withFloat.y))
})

describe('llToTile', () => {
  it('0-0-0: center point', () => {
    const tile = llToTile({ x: 0, y: 0 }, 0, 512)
    expect(tile).toEqual({ x: 0, y: 0 })
  })

  it('0-0-0: top left', () => {
    const tile = llToTile({ x: -180, y: 85.05 }, 0, 512)
    expect(tile).toEqual({ x: 0, y: 0 })
  })

  // zoom 1
  it('1-0-0: center point', () => {
    const tile = llToTile({ x: 0, y: 0 }, 1, 512)
    expect(tile).toEqual({ x: 1, y: 1 })
  })

  it('1-0-0: top left', () => {
    const tile = llToTile({ x: -180, y: 85.05 }, 1, 512)
    expect(tile).toEqual({ x: 0, y: 0 })
  })
})

describe('llToTilePx', () => {
  it('0-0-0: center point', () => {
    const tileOffset = llToTilePx({ x: 0, y: 0 }, [0, 0, 0], 512)
    expect(tileOffset).toEqual({ x: 0.5, y: 0.5 })
  })

  it('2-3-3: center point', () => {
    const tileOffset = llToTilePx({ x: 0, y: 0 }, [2, 3, 3], 512)
    expect(tileOffset).toEqual({ x: -1, y: -1 })
  })

  it('0-1-0: out of bounds tile with center point (used for world wrapping)', () => {
    const tileOffset = llToTilePx({ x: 0, y: 0 }, [0, 2, 0], 512)
    expect(tileOffset).toEqual({ x: -1.5, y: 0.5 })
  })

  it('0-0-0: top left', () => {
    const tileOffset = llToTilePx({ x: -180, y: 85.05 }, [0, 0, 0], 512)
    expect(tileOffset).toEqual({ x: 0, y: 0.00003634242909722474 })
  })

  it('0-0-0: top right', () => {
    const tileOffset = llToTilePx({ x: 180, y: 85.05 }, [0, 0, 0], 512)
    expect(tileOffset).toEqual({ x: 1, y: 0.00003634242909722474 })
  })

  it('0-0-0: bottom right', () => {
    const tileOffset = llToTilePx({ x: 180, y: -85.05 }, [0, 0, 0], 512)
    expect(tileOffset).toEqual({ x: 1, y: 0.9999636575709028 })
  })

  it('0-0-0: bottom left', () => {
    const tileOffset = llToTilePx({ x: -180, y: -85.05 }, [0, 0, 0], 512)
    expect(tileOffset).toEqual({ x: 0, y: 0.9999636575709028 })
  })

  it('center for zoom 1 tiles', () => {
    const tileOffset00 = llToTilePx({ x: 0, y: 0 }, [1, 0, 0], 512)
    expect(tileOffset00).toEqual({ x: 1, y: 1 })

    const tileOffset10 = llToTilePx({ x: 0, y: 0 }, [1, 1, 0], 512)
    expect(tileOffset10).toEqual({ x: 0, y: 1 })

    const tileOffset01 = llToTilePx({ x: 0, y: 0 }, [1, 0, 1], 512)
    expect(tileOffset01).toEqual({ x: 1, y: 0 })

    const tileOffset11 = llToTilePx({ x: 0, y: 0 }, [1, 1, 1], 512)
    expect(tileOffset11).toEqual({ x: 0, y: 0 })
  })
})

test('llToMerc', () => {
  expect(llToMerc({ x: 0, y: 0 })).toEqual({ x: 0, y: -7.081154551613622e-10 })
  expect(llToMerc({ x: -180, y: 90 })).toEqual({ x: -20037508.34278924, y: 20037508.342789244 })
  expect(llToMerc({ x: 180, y: -90 })).toEqual({ x: 20037508.34278924, y: -20037508.342789244 })
})

test('mercToLL', () => {
  expect(mercToLL({ x: 0, y: -7.081154551613622e-10 })).toEqual({ x: 0, y: 0 })
  expect(mercToLL({ x: -20037508.34278924, y: 20037508.342789244 })).toEqual({ x: -179.99999999999997, y: 85.05112877980659 })
  expect(mercToLL({ x: 20037508.34278924, y: -20037508.342789244 })).toEqual({ x: 179.99999999999997, y: -85.05112877980659 })
})

test('pxToTile', () => {
  expect(pxToTile({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  expect(pxToTile({ x: 600, y: 2_000 })).toEqual({ x: 1, y: 3 })
})

test('tilePxBounds', () => {
  expect(tilePxBounds([0, 0, 0])).toEqual([0, 0, 512, 512])
  expect(tilePxBounds([1, 0, 0])).toEqual([0, 0, 512, 512])
  expect(tilePxBounds([1, 1, 0])).toEqual([512, 0, 1024, 512])
  expect(tilePxBounds([2, 2, 2])).toEqual([1024, 1024, 1536, 1536])
})

test('mercatorXfromLng', () => {
  expect(mercatorXfromLng(0)).toEqual(0.5)
  expect(mercatorXfromLng(-180)).toEqual(0)
  expect(mercatorXfromLng(180)).toEqual(1)
})

test('mercatorYfromLat', () => {
  expect(mercatorYfromLat(0)).toEqual(0.5)
  expect(mercatorYfromLat(-85.05112877980659)).toEqual(0.9999999999999999)
  expect(mercatorYfromLat(85.05112877980659)).toEqual(-7.894919286223336e-17)
  // out of bounds numbers
  expect(mercatorYfromLat(90)).toEqual(-5.441549447954536)
  expect(mercatorYfromLat(-90)).toEqual(Infinity)
})

test('mercatorZfromAltitude', () => {
  expect(mercatorZfromAltitude(0, 0)).toEqual(0)
  expect(mercatorZfromAltitude(1_000_000, 0)).toEqual(0.0249811212145705)
  expect(mercatorZfromAltitude(1_000_000, 60)).toEqual(0.04996224242914099)
})

test('lngFromMercatorX', () => {
  expect(lngFromMercatorX(0.5)).toEqual(0)
  expect(lngFromMercatorX(0)).toEqual(-180)
  expect(lngFromMercatorX(1)).toEqual(180)
})

test('latFromMercatorY', () => {
  expect(latFromMercatorY(0.5)).toEqual(0)
  expect(latFromMercatorY(1)).toEqual(-85.05112877980659)
  expect(latFromMercatorY(0)).toEqual(85.05112877980659)
  // out of bounds numbers
  expect(latFromMercatorY(2)).toEqual(-89.99075251648904)
  expect(latFromMercatorY(-1)).toEqual(89.99075251648904)
})

test('altitudeFromMercatorZ', () => {
  expect(altitudeFromMercatorZ(0, 0)).toEqual(0)
  expect(altitudeFromMercatorZ(0.0249811212145705, 0)).toEqual(86_266.73833405455)
  expect(altitudeFromMercatorZ(0.04996224242914099, 60)).toEqual(1.224646799147353e-10)
})

test('mercatorLatScale', () => {
  expect(mercatorLatScale(0)).toEqual(1)
  expect(mercatorLatScale(45)).toEqual(1.414213562373095)
  expect(mercatorLatScale(-45)).toEqual(1.414213562373095)
  expect(mercatorLatScale(85)).toEqual(11.47371324566986)
  expect(mercatorLatScale(-85)).toEqual(11.47371324566986)
})
