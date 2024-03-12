import Orthodrome from 'geometry/lonlat/orthodrome'
import { describe, expect, test } from 'bun:test'

describe('Orthodrome', () => {
  test('intermediatePoint', () => {
    const orthodrome = new Orthodrome(0, 0, 90, 0)
    expect(orthodrome.intermediatePoint(0)).toEqual([0, 0])
    expect(orthodrome.intermediatePoint(0.5)).toEqual([45, 0])
    expect(orthodrome.intermediatePoint(1)).toEqual([90, 0])
  })
  test('distanceTo', () => {
    const orthodrome = new Orthodrome(0, 0, 90, 0)
    expect(orthodrome.distanceTo()).toBeCloseTo(1.5707963267948966)
  })

  test('intermediatePoint', () => {
    const orthodrome = new Orthodrome(20, 20, 40, 40)
    expect(orthodrome.intermediatePoint(0)).toEqual([20, 20])
    expect(orthodrome.intermediatePoint(0.5)).toEqual([28.971621691857216, 30.377228473165168])
    expect(orthodrome.intermediatePoint(1)).toEqual([40, 40])
  })
})
