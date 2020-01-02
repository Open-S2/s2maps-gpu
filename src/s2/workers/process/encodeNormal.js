// @flow
import { S2Point } from 's2projection'

export default function encodeNormal (point: S2Point): [number, number] {
  const p = Math.sqrt(point.z * 8.0 + 8.0)

  return [
    point.x / p + 0.5,
    point.y / p + 0.5
  ]
}
