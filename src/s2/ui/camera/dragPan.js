// @flow

// t: time | b: start value | c: change in value | d: duration
const easeOutExp = (delta, movement, animationLength) => {
  return -movement * ( -Math.pow( 2, -10 * delta / animationLength ) + 1 ) + movement
}

export default class DragPan extends EventTarget {
  active: boolean = false // false mean's 'inactive', true is 'active'
  animationLength: number = 1.75
  minMovementX: number = 1
  minMovementY: number = 0.5
  movementX: number = 0
  movementY: number = 0
  totalMovementX: number = 0
  totalMovementY: number = 0
  time: number = -1
  clear () {
    this.active = false
    this.time = -1
  }

  onMouseDown (e: MouseEvent) {
    this.active = true
    this.movementX = 0
    this.movementY = 0
    this.totalMovementX = 0
    this.totalMovementY = 0
    this.time = -1
  }

  onMouseUp (e: MouseEvent) {
    this.active = false
    this.time = 0
    // if movement is greater than mins, animate swipe,
    // otherwise if total movement is less than mins it's considered a click
    if (Math.abs(this.movementX) > this.minMovementX || Math.abs(this.movementY) > this.minMovementY) {
      this.dispatchEvent(new Event('swipe'))
    } else if (Math.abs(this.totalMovementX) < this.minMovementX && Math.abs(this.totalMovementY) < this.minMovementY) {
      this.dispatchEvent(new Event('click'))
    }
  }

  // tracks movement if the left click actively pressed
  // or it tracks what features are currently active
  onMouseMove (e: MouseEvent) {
    if (this.active) {
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
