// @flow

// t: time | b: start value | c: change in value | d: duration
const easeOutExp = (delta, movement, animationLength) => {
  return -movement * ( -Math.pow( 2, -10 * delta / animationLength ) + 1 ) + movement
}

export default class DragPan extends EventTarget {
  mouseActive: boolean = false // when a user presses left click and moves during the press
  swipeActive: boolean = false // when user clicks and drags at a fast enough pace to cause the world to keep moving after unpressing the left mouse button
  wasActive: boolean = false // if a onMouseDown event comes up, we want to check if the map was previously active to avoid unecessary click events
  animationLength: number = 1.75
  minMovementX: number = 1
  minMovementY: number = 0.5
  movementX: number = 0
  movementY: number = 0
  totalMovementX: number = 0
  totalMovementY: number = 0
  time: number = -1
  clear () {
    this.mouseActive = false
    this.swipeActive = false
    this.time = -1
  }

  onMouseDown (e: MouseEvent) {
    // if we were actively moving (swipe animation) than we should not register a click. this is prep for that
    // NOTE: We don't have to study if we were zooming because browsers naturally ignore propogating clicks during a zoom
    if (this.mouseActive || this.swipeActive) this.wasActive = true
    else this.wasActive = false
    this.clear()
    this.mouseActive = true
    this.movementX = 0
    this.movementY = 0
    this.totalMovementX = 0
    this.totalMovementY = 0
  }

  onMouseUp (e: MouseEvent) {
    this.mouseActive = false
    this.time = 0
    // if movement is greater than mins, animate swipe,
    // otherwise if total movement is less than mins it's considered a click
    if (Math.abs(this.movementX) > this.minMovementX || Math.abs(this.movementY) > this.minMovementY) {
      this.dispatchEvent(new Event('swipe'))
    } else if (Math.abs(this.totalMovementX) < this.minMovementX && Math.abs(this.totalMovementY) < this.minMovementY) {
      if (!this.wasActive) this.dispatchEvent(new Event('click'))
    }
  }

  // tracks movement if the left click actively pressed
  // or it tracks what features are currently active
  onMouseMove (e: MouseEvent) {
    if (this.mouseActive) {
      const { movementX, movementY } = e
      this.movementX = movementX
      this.movementY = movementY
      this.totalMovementX += movementX
      this.totalMovementY += movementY
      this.dispatchEvent(new Event('move'))
    }
  }

  getNextFrame (now: number) {
    now *= 0.001 // Convert to seconds
    if (this.time === -1) return [0, 0, 0]
    if (this.time === 0) this.time = now
    const delta = now - this.time
    if (delta > this.animationLength) this.time = 0
    // find the velocity
    return [
      easeOutExp(delta, this.movementX, this.animationLength),
      easeOutExp(delta, this.movementY, this.animationLength),
      this.time
    ]
  }
}
