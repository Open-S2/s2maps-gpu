import {
  childrenIJ as childrenIJS2,
  contains as containsS2,
  face as faceS2,
  fromFace as fromFaceS2,
  isFace as isFaceS2,
  level as levelS2,
  parent as parentS2,
  toIJ as toIJS2
} from './s2/s2CellID'
import {
  children as childrenWM,
  contains as containsWM,
  isFace as isFaceWM,
  level as levelWM,
  parent as parentWM,
  toID as toIDWM,
  toIJ as toIJWM
} from './webMerc/mercID'

import type { Face } from './s2'
import type { Projection } from 'style/style.spec'

export function parent (proj: Projection, id: bigint): bigint {
  if (proj === 'S2') return parentS2(id)
  else return parentWM(id)
}

export function childrenIJ (
  proj: Projection,
  face: Face,
  zoom: number,
  i: number,
  j: number
): [bigint, bigint, bigint, bigint] {
  if (proj === 'S2') return childrenIJS2(face, zoom, i, j)
  else return childrenWM(toIDWM(zoom, i, j))
}

export function isFace (proj: Projection, id: bigint): boolean {
  if (proj === 'S2') return isFaceS2(id)
  else return isFaceWM(id)
}

export function face (proj: Projection, id: bigint): Face {
  if (proj === 'S2') return faceS2(id)
  else return 0 as Face
}

export function fromFace (proj: Projection, face: Face): bigint {
  if (proj === 'S2') return fromFaceS2(face)
  else return 0n
}

export function toIJ (
  proj: Projection,
  id: bigint,
  level?: number | bigint
): [faceOrZoom: number, i: number, j: number] {
  if (proj === 'S2') return toIJS2(id, level).slice(0, 3) as [number, number, number]
  else return toIJWM(id, level)
}

// find the "level" or "zoom" of the id
export function level (
  proj: Projection,
  id: bigint
): number {
  if (proj === 'S2') return levelS2(id)
  else return levelWM(id)
}

export function contains (proj: Projection, parentID: bigint, childID: bigint): boolean {
  if (proj === 'S2') return containsS2(parentID, childID)
  else return containsWM(parentID, childID)
}
