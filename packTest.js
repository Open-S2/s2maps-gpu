// @flow
// modified version of https://github.com/mapbox/potpack
// we avoid objects because it is an uneccessary waste of objects and garbage collection
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
// @flow
// flow/standard modified version of https://github.com/mapbox/potpack
// we avoid objects in 'spaces' because it is an uneccessary waste of lookups and garbage collection
/*******
Example:
const boxes = [
  { w: w1, h: h1 },
  { w: w2, h: h2 },
  { w: w3, h: h3 },
  ...
]
const { width, height } = texturePack(boxes)

console.log(boxes[0]) // { w: number, h: number, x: number, y: number }
********/

function texturePack (boxes) {
  // sort the boxes for insertion by height, descending
  boxes.sort((a, b) => b.h - a.h)
  // calculate total box area and maximum box width
  let area = 0
  let maxWidth = 0

  for (const box of boxes) {
    area += box.w * box.h
    maxWidth = Math.max(maxWidth, box.w)
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
      if (box.w > space[0] || box.h > space[1]) continue

      // found the space; add the box to its top-left corner
      // |-------|-------|
      // |  box  |       |
      // |_______|       |
      // |         space |
      // |_______________|
      box.x = space[2]
      box.y = space[3]

      height = Math.max(height, box.y + box.h)
      width = Math.max(width, box.x + box.w)

      if (box.w === space[0] && box.h === space[1]) {
          // space matches the box exactly; remove it
          const last = spaces.pop()
          if (i < spaces.length) spaces[i] = last
      } else if (box.h === space[1]) {
          // space matches the box height; update it accordingly
          // |-------|---------------|
          // |  box  | updated space |
          // |_______|_______________|
          space[2] += box.w
          space[0] -= box.w
      } else if (box.w === space[0]) {
        // space matches the box width; update it accordingly
        // |---------------|
        // |      box      |
        // |_______________|
        // | updated space |
        // |_______________|
        space[3] += box.h
        space[1] -= box.h
      } else {
        // otherwise the box splits the space into two spaces
        // |-------|-----------|
        // |  box  | new space |
        // |_______|___________|
        // | updated space     |
        // |___________________|
        spaces.push([space[0] - box.w, box.h, space[2] + box.w, space[3]])

        space[3] += box.h
        space[1] -= box.h
      }

      break
    }
  }

  return { width, height }
}


const boxes = [
  { w: 300, h: 100 },
  { w: 100,h:  50 },
  { w: 100, h: 75 },
  { w: 200,h:  75 },
  { w: 500, h: 50 },
  { w: 200, h: 100 },
  { w: 175, h: 20 },
  { w: 322, h: 500 },
  { w: 100,h:  100 },
  { w: 265, h: 10 },
  { w: 400, h: 25 }
]
const { width, height } = texturePack(boxes)

console.log(width, height, boxes) // [width1, height1, posX, posY]
