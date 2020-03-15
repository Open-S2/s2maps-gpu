// @flow
type Anchor = 'auto' | 'center' | 'topRight' | 'right' | 'bottomRight' | 'bottom' | 'bottomLeft' | 'left' | 'topLeft'

export default function coalesceAnchor (anchor: Anchor): number {
  switch (anchor) {
    case 'auto': return 0
    case 'center': return 1
    case 'top': return 2
    case 'topRight': return 3
    case 'right': return 4
    case 'bottomRight': return 5
    case 'bottom': return 6
    case 'bottomLeft': return 7
    case 'left': return 8
    case 'topLeft': return 9
    default: return 1
  }
}
