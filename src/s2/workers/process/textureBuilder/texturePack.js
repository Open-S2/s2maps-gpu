// @flow
// modified version of https://github.com/mapbox/potpack
// we avoid objects in 'spaces' because it is an uneccessary waste of lookups and garbage collection
/*******
Example:
const boxes = [
  { width: width1, height: height1 },
  { width: width2, height: height2 },
  { width: width3, height: height3 },
  ...
]
const { width, height } = texturePack(boxes)

console.log(boxes[0]) // { width: width1, height: height1, x: posX, y: posY }
********/
type Box = {
  width: number,
  height: number,
  x?: number,
  y?: number
}

export default function texturePack (boxes: Array<Box>): { width: number, height: number } {
  // sort the boxes for insertion by height, descending
  boxes.sort((a, b) => b.height - a.height)
  // calculate total box area and maximum box width
  let area = 0
  let maxWidth = 0

  for (const box of boxes) {
    area += box.width * box.height
    maxWidth = Math.max(maxWidth, box.width)
  }

  // aim for a squarish resulting container,
  // slightly adjusted for sub-100% space utilization
  const startWidth = Math.max(Math.ceil(Math.sqrt(area / 0.95)), maxWidth)

  // start with a single empty space, unbounded at the bottom
  const spaces = [[startWidth, Infinity, 0, 0]] // [width, height, x, y]

  let width = 0
  let height = 0

  for (const box of boxes) {
    // look through spaces backwards so that we check smaller spaces first
    for (let i = spaces.length - 1; i >= 0; i--) {
      const space = spaces[i]

      // look for empty spaces that can accommodate the current box
      if (box.width > space[0] || box.height > space[1]) continue

      // found the space; add the box to its top-left corner
      // |-------|-------|
      // |  box  |       |
      // |_______|       |
      // |         space |
      // |_______________|
      box.x = space[2]
      box.y = space[3]

      height = Math.max(height, box.y + box.height)
      width = Math.max(width, box.x + box.width)

      if (box.width === space[0] && box.height === space[1]) {
          // space matches the box exactly; remove it
          const last = spaces.pop()
          if (i < spaces.length) spaces[i] = last
      } else if (box.height === space[1]) {
          // space matches the box height; update it accordingly
          // |-------|---------------|
          // |  box  | updated space |
          // |_______|_______________|
          space[2] += box.width
          space[0] -= box.width
      } else if (box.width === space[0]) {
        // space matches the box width; update it accordingly
        // |---------------|
        // |      box      |
        // |_______________|
        // | updated space |
        // |_______________|
        space[3] += box.height
        space[1] -= box.height
      } else {
        // otherwise the box splits the space into two spaces
        // |-------|-----------|
        // |  box  | new space |
        // |_______|___________|
        // | updated space     |
        // |___________________|
        spaces.push([space[0] - box.width, box.height, space[2] + box.width, space[3]])

        space[3] += box.height
        space[1] -= box.height
      }

      break
    }
  }

  return { width, height }
}
