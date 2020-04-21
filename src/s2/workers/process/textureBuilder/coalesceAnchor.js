// @flow
type Anchor = 'center' | 'topRight' | 'right' | 'bottomRight' | 'bottom' | 'bottomLeft' | 'left' | 'topLeft'

export default function coalesceAnchor (anchor: Anchor): number {
  switch (anchor) {
    case 'center': return 0
    case 'top': return 1
    case 'topRight': return 2
    case 'right': return 3
    case 'bottomRight': return 4
    case 'bottom': return 5
    case 'bottomLeft': return 6
    case 'left': return 7
    case 'topLeft': return 8
    default: return 0
  }
}
