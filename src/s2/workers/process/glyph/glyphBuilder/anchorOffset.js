// flow
import type { Anchor } from './coalesceAnchor'

export default function anchorOffset (anchor: Anchor, width: number, height: number) {
  if (anchor === 0) return [-width / 2, -height / 2]
  else if (anchor === 1) return [-width, -height / 2]
  else if (anchor === 2) return [-width, 0]
  else if (anchor === 3) return [-width / 2, 0]
  else if (anchor === 4) return [0, 0]
  else if (anchor === 5) return [0, -height / 2]
  else if (anchor === 6) return [0, -height]
  else if (anchor === 7) return [-width / 2, -height]
  else if (anchor === 8) return [-width, -height]
  else return [0, 0]
}
