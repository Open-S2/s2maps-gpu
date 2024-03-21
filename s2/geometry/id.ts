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
  fromID as fromIDWM,
  isFace as isFaceWM,
  level as levelWM,
  parent as parentWM,
  toID as toIDWM,
  toIJ as toIJWM
} from './wm/mercID'

import type { Face } from './s2'
import type { Projection } from 'style/style.spec'
import type { FaceIJ } from './proj.spec'

export function fromID (proj: Projection, id: bigint): [face: Face, zoom: number, i: number, j: number] {
  if (proj === 'S2') {
    const zoom = levelS2(id)
    const [face, i, j] = toIJS2(id, zoom)
    return [face, zoom, i, j]
  } else return [0, ...fromIDWM(id)]
}

/** Given the projection, get the parent tile of the input ID */
export function parent (proj: Projection, id: bigint): bigint {
  if (proj === 'S2') return parentS2(id)
  else return parentWM(id)
}

/** Given the projection, get the children tiles given the face-zoom-i-j. */
export function childrenIJ (
  proj: Projection,
  face: Face,
  zoom: number,
  i: number,
  j: number
): [blID: bigint, brID: bigint, tlID: bigint, trID: bigint] {
  if (proj === 'S2') return childrenIJS2(face, zoom, i, j)
  else return childrenWM(toIDWM(zoom, i, j))
}

/** Given the projection, check if the tile ID is of the highest zoom or not. */
export function isFace (proj: Projection, id: bigint): boolean {
  if (proj === 'S2') return isFaceS2(id)
  else return isFaceWM(id)
}

/** Given the projection, get the face of the input ID. If not S2, gaurenteed to be 0. */
export function face (proj: Projection, id: bigint): Face {
  if (proj === 'S2') return faceS2(id)
  else return 0 as Face
}

/** Given the projection, get the ID of a requested face. If not S2, gaurenteed to be 0. */
export function fromFace (proj: Projection, face: Face): bigint {
  if (proj === 'S2') return fromFaceS2(face)
  else return 0n
}

/** Given the projection, get the ID of a requested zoom-i-j. */
export function toIJ (
  proj: Projection,
  id: bigint,
  level?: number | bigint
): [faceOrZoom: number, i: number, j: number] {
  if (proj === 'S2') return toIJS2(id, level).slice(0, 3) as FaceIJ
  else return toIJWM(id, level)
}

/** Given the projection and tile ID, get the zoom of said tile. */
export function level (
  proj: Projection,
  id: bigint
): number {
  if (proj === 'S2') return levelS2(id)
  else return levelWM(id)
}

/** Given the projection, check if the "child" exists inside the "parent"'s bounds or not. */
export function contains (proj: Projection, parentID: bigint, childID: bigint): boolean {
  if (proj === 'S2') return containsS2(parentID, childID)
  else return containsWM(parentID, childID)
}
