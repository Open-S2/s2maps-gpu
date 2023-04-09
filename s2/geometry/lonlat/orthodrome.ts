import { radToDeg, degToRad } from '../util'

// http://www.movable-type.co.uk/scripts/latlong.html
export default class Orthodrome {
  λ1: number // startLon
  φ1: number // startLat
  λ2: number // endLon
  φ2: number // endLat
  a: number // distance property
  δ: number // distance property
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

  intermediatePoint (t: number): [number, number] {
    const { λ1, λ2, φ1, φ2, δ } = this
    const { sin, cos, atan2, sqrt } = Math

    const A = sin((1 - t) * δ) / sin(δ)
    const B = sin(t * δ) / sin(δ)

    const x = A * cos(φ1) * cos(λ1) + B * cos(φ2) * cos(λ2)
    const y = A * cos(φ1) * sin(λ1) + B * cos(φ2) * sin(λ2)
    const z = A * sin(φ1) + B * sin(φ2)

    const φ3 = atan2(z, sqrt(x * x + y * y))
    const λ3 = atan2(y, x)

    return [radToDeg(λ3), radToDeg(φ3)]
  }

  // projected without a radius (0->1)
  distanceTo (): number {
    const { a } = this
    const { atan2, sqrt } = Math

    return 2 * atan2(sqrt(a), sqrt(1 - a))
  }
}
