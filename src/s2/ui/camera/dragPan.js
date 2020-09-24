// @flow
/* global Event */
import EventListener from '../../util/EventListener'

type TouchEvent = {
  length: number,
  [number]: {
    clientX: number,
    clientY: number
  }
}

// t: time | b: start value | c: change in value | d: duration
function easeOutExp (delta: number, movement: number, animationLength: number): number {
  return -movement * (-Math.pow(2, -10 * delta / animationLength) + 1) + movement
}

export default class DragPan extends EventListener {
  zoomActive: boolean = false // allow two finger zooming
  mouseActive: boolean = false // when a user presses left click and moves during the press
  wasActive: boolean = false // if a onMouseDown event comes up, we want to check if the map was previously active to avoid unecessary click events
  animSeed: number = 0
  minMovementX: number = 1
  minMovementY: number = 0.5
  movementX: number = 0
  movementY: number = 0
  totalMovementX: number = 0
  totalMovementY: number = 0
  touchDeltaX: number = 0
  touchDeltaY: number = 0
  touchDeltaZ: number = 0
  zoom: number = 0
  time: number = -1
  clear () {
    this.movementX = 0
    this.movementY = 0
    this.totalMovementX = 0
    this.totalMovementY = 0
    this.zoom = 0
    this.time = -1
    this.newSeed()
  }

  newSeed () {
    this.animSeed++
    if (this.animSeed > 1000) this.animSeed = 0
    return this.animSeed
  }

  onTouchStart (touches: TouchEvent) {
    this._setTouchDelta(touches)
    this.mouseActive = true
  }

  onTouchEnd (touches: TouchEvent) {
    this._setTouchDelta(touches)
  }

  _setTouchDelta (touches: TouchEvent) {
    const { length } = touches
    if (length) {
      let { clientX, clientY } = touches[0]
      this.touchDeltaX = clientX
      this.touchDeltaY = clientY
      if (length > 1 && this.zoomActive) {
        clientX = touches[length - 1].clientX
        clientY = touches[length - 1].clientY
        this.touchDeltaZ = Math.hypot(this.touchDeltaX - clientX, this.touchDeltaY - clientY)
      } else {
        this.clear()
      }
    } else {
      this.onMouseUp()
    }
  }

  onMouseDown () {
    // set to active and set starting movement
    this.mouseActive = true
    this.clear()
  }

  onMouseUp () {
    this.mouseActive = false
    this.time = 0
    // if movement is greater than mins, animate swipe,
    // otherwise if total movement is less than mins it's considered a click
    if (Math.abs(this.movementX) > this.minMovementX || Math.abs(this.movementY) > this.minMovementY) {
      this.wasActive = true
      this.dispatchEvent(new Event('swipe'))
    } else if (Math.abs(this.totalMovementX) < this.minMovementX && Math.abs(this.totalMovementY) < this.minMovementY) {
      if (!this.wasActive) this.dispatchEvent(new Event('click'))
      else this.wasActive = false
    } else { this.wasActive = false }
  }

  // tracks movement if the left click actively pressed
  // or it tracks what features are currently active
  onMouseMove (movementX: number, movementY: number) {
    if (this.mouseActive) {
      this.movementX = movementX
      this.movementY = movementY
      this.totalMovementX += movementX
      this.totalMovementY += movementY
      this.dispatchEvent(new Event('move'))
    }
  }

  onTouchMove (touches: TouchEvent) {
    const { length } = touches
    let { clientX, clientY } = touches[0]
    if (length > 1 && this.zoomActive) {
      // zoom
      // update new position of first finger
      this.touchDeltaX = clientX
      this.touchDeltaY = clientY
      // get position of last finger
      clientX = touches[length - 1].clientX
      clientY = touches[length - 1].clientY
      // set change in finger distance
      const deltaZ = Math.hypot(this.touchDeltaX - clientX, this.touchDeltaY - clientY)
      this.zoom = (this.touchDeltaZ - deltaZ) * 2
      this.dispatchEvent(new Event('zoom'))
      this.touchDeltaZ = deltaZ
    } else if (this.mouseActive) {
      // move
      const deltaX = clientX - this.touchDeltaX
      const deltaY = clientY - this.touchDeltaY
      this.movementX = deltaX
      this.movementY = deltaY
      this.totalMovementX += deltaX
      this.totalMovementY += deltaY
      // set new position
      this.touchDeltaX = clientX
      this.touchDeltaY = clientY
      this.dispatchEvent(new Event('move'))
    }
  }

  getNextZoomFrame (now: number) {
    const delta = now - this.time
    if (delta > 1) {
      this.clear()
      return 1
    }
    return 1 - easeOutExp(delta, 1, 1)
  }

  getNextSwipeFrame (now: number) {
    if (this.time === -1) {
      this.newSeed()
      return [0, 0, 0]
    }
    if (this.time === 0) this.time = now
    const delta = now - this.time
    if (delta > 1.75) {
      this.time = 0
      this.clear()
    }
    // find the velocity
    return [
      easeOutExp(delta, this.movementX, 1.75),
      easeOutExp(delta, this.movementY, 1.75),
      this.time
    ]
  }
}
