// flow
export type Anchor = 'center' | 'topRight' | 'right' | 'bottomRight' | 'bottom' | 'bottomLeft' | 'left' | 'topLeft'

export default function anchorOffset (anchor: Anchor, width: number): [number, number] {
  if (anchor === 'center') return [-width / 2, -1 / 2]
  else if (anchor === 'top') return [-width / 2, -1]
  else if (anchor === 'topRight') return [-width, -1]
  else if (anchor === 'right') return [-width, -1 / 2]
  else if (anchor === 'bottomRight') return [-width, 0]
  else if (anchor === 'bottom') return [-width / 2, 0]
  else if (anchor === 'bottomLeft') return [0, 0]
  else if (anchor === 'left') return [0, -1 / 2]
  else if (anchor === 'topLeft') return [0, -1]
  else return [-width / 2, -1 / 2] // default to center
}
