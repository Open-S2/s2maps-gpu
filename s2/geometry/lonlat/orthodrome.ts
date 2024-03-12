import { degToRad, radToDeg } from '../util'

/**
 * Represents an orthodrome, which is the shortest path between two points on a sphere.
 * [Learn more here](http://www.movable-type.co.uk/scripts/latlong.html)
 */
export default class Orthodrome {
  /** start longitude */
  private readonly λ1: number
  /** start latitude */
  private readonly φ1: number
  /** end longitude */
  private readonly λ2: number
  /** end latitude */
  private readonly φ2: number
  /** distance property */
  private readonly a: number
  /** distance property */
  private readonly δ: number
  constructor (startLon: number, startLat: number, endLon: number, endLat: number) {
    const { sin, cos, atan2, sqrt } = Math
    const λ1 = this.λ1 = degToRad(startLon)
    const φ1 = this.φ1 = degToRad(startLat)
    const λ2 = this.λ2 = degToRad(endLon)
    const φ2 = this.φ2 = degToRad(endLat)
    const Δφ = φ2 - φ1
    const Δλ = λ2 - λ1
    const a = this.a = sin(Δφ / 2) * sin(Δφ / 2) + cos(φ1) * cos(φ2) * sin(Δλ / 2) * sin(Δλ / 2)
    this.δ = 2 * atan2(sqrt(a), sqrt(1 - a))
  }

  /**
   * input t 0->1. Find a point along the orthodrome.
   * returns [lon, lat]
   */
  intermediatePoint (t: number): [lon: number, lat: number] {
    const { λ1, λ2, φ1, φ2, δ } = this
    const { sin, cos, atan2, sqrt } = Math

    // check corner cases first
    if (t === 0) return [radToDeg(λ1), radToDeg(φ1)]
    else if (t === 1) return [radToDeg(λ2), radToDeg(φ2)]

    const A = sin((1 - t) * δ) / sin(δ)
    const B = sin(t * δ) / sin(δ)

    const x = A * cos(φ1) * cos(λ1) + B * cos(φ2) * cos(λ2)
    const y = A * cos(φ1) * sin(λ1) + B * cos(φ2) * sin(λ2)
    const z = A * sin(φ1) + B * sin(φ2)

    const φ3 = atan2(z, sqrt(x * x + y * y))
    const λ3 = atan2(y, x)

    return [radToDeg(λ3), radToDeg(φ3)]
  }

  /** projected normalized (0->1) */
  distanceTo (): number {
    const { a } = this
    const { atan2, sqrt } = Math

    return 2 * atan2(sqrt(a), sqrt(1 - a))
  }
}
