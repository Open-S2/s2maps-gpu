import {
  A,
  EARTH_RADIUS,
  EARTH_RADIUS_EQUATORIAL,
  EARTH_RADIUS_POLAR,
  MARS_RADIUS,
  MARS_RADIUS_EQUATORIAL,
  MARS_RADIUS_POLAR,
  MAXEXTENT,
  MAXLAT,
  degToRad,
  mod,
  radToDeg
} from 'geometry/util'
import { describe, expect, it } from 'bun:test'

describe('radToDeg', () => {
  it('converts radians to degrees', () => {
    expect(radToDeg(Math.PI)).toEqual(180)
  })
})

describe('degToRad', () => {
  it('converts degrees to radians', () => {
    expect(degToRad(180)).toEqual(Math.PI)
  })
})

describe('EARTH_RADIUS', () => {
  it('is 6371008.8 meters', () => {
    expect(EARTH_RADIUS).toEqual(6371008.8)
  })
})

describe('EARTH_RADIUS_EQUATORIAL', () => {
  it('is 6378137 meters', () => {
    expect(EARTH_RADIUS_EQUATORIAL).toEqual(6378137)
  })
})

describe('EARTH_RADIUS_POLAR', () => {
  it('is 6356752.3 meters', () => {
    expect(EARTH_RADIUS_POLAR).toEqual(6356752.3)
  })
})

describe('MARS_RADIUS', () => {
  it('is 3389500 meters', () => {
    expect(MARS_RADIUS).toEqual(3389500)
  })
})

describe('MARS_RADIUS_EQUATORIAL', () => {
  it('is 3396200 meters', () => {
    expect(MARS_RADIUS_EQUATORIAL).toEqual(3396200)
  })
})

describe('MARS_RADIUS_POLAR', () => {
  it('is 3376200 meters', () => {
    expect(MARS_RADIUS_POLAR).toEqual(3376200)
  })
})

describe('A', () => {
  it('is 6378137.0 meters', () => {
    expect(A).toEqual(6378137.0)
  })
})

describe('MAXEXTENT', () => {
  it('is 20037508.342789244', () => {
    expect(MAXEXTENT).toEqual(20037508.342789244)
  })
})

describe('MAXLAT', () => {
  it('is 85.0511287798', () => {
    expect(MAXLAT).toEqual(85.0511287798)
  })
})

describe('mod', () => {
  it('works with positive numbers', () => {
    expect(mod(5, 3)).toEqual(2)
  })

  it('works with negative numbers', () => {
    expect(mod(-5, 3)).toEqual(1)
  })
})
