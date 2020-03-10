// @flow
// modified version of https://github.com/mapbox/potpack
// we avoid objects because it is an uneccessary waste of lookups and garbage collection
/*******
Example:
const boxes = [
  [width1, height1],
  [width2, height2],
  [width3, height3],
  ...
]
const { width, height } = texturePack(boxes)

console.log(boxes[0]) // [width1, height1, posX, posY]
********/
export default function texturePack (boxes: Array<Array<number>>): { width: number, height: number } {
    // calculate total box area and maximum box width
    let area = 0
    let maxWidth = 0

    for (const box of boxes) {
      area += box[0] * box[1]
      maxWidth = Math.max(maxWidth, box[0])
    }

    // sort the boxes for insertion by height, descending
    boxes.sort((a, b) => b[1] - a[1])

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
        if (box[0] > space[0] || box[1] > space[1]) continue

        // found the space: add the box to its top-left corner
        // |-------|-------|
        // |  box  |       |
        // |_______|       |
        // |         space |
        // |_______________|
        box.push(space[2])
        box.push(space[3])

        height = Math.max(height, box[3] + box[2])
        width = Math.max(width, box[2] + box[0])

        if (box[0] === space[0] && box[1] === space[1]) {
          // space matches the box exactly: remove it
          const last = spaces.pop()
          if (i < spaces.length) spaces[i] = last
        } else if (box[1] === space[1]) {
          // space matches the box height: update it accordingly
          // |-------|---------------|
          // |  box  | updated space |
          // |_______|_______________|
          space[2] += box[0]
          space[0] -= box[0]
        } else if (box[0] === space[0]) {
          // space matches the box width: update it accordingly
          // |---------------|
          // |      box      |
          // |_______________|
          // | updated space |
          // |_______________|
          space[3] += box[1]
          space[1] -= box[1]
        } else {
          // otherwise the box splits the space into two spaces
          // |-------|-----------|
          // |  box  | new space |
          // |_______|___________|
          // | updated space     |
          // |___________________|
          spaces.push([space[2] + box[0], space[1], space[0] - box[0], box[1]])
          space[3] += box[1]
          space[1] -= box[1]
        }

        break
      }
    }

    return {
      width: width, // container width
      height: height // container height
    }
}
