/* eslint-env browser */

const DOUBLE_CLICK_TIMEOUT = 175

export interface UserTouchEvent {
  length: number
  [key: number]: {
    clientX: number
    clientY: number
    x: number
    y: number
  }
}

export interface ClickEvent {
  detail: {
    posX: number
    posY: number
  }
}

/**
 * DragPan is a class that handles mouse and touch events for panning and zooming
 * @example
 * const dragPan = new DragPan()
 * dragPan.addEventListener('move', () => {
 *  console.info(dragPan.movementX, dragPan.movementY)
 * })
 */
export default class DragPan extends EventTarget {
  zoomActive = false // allow two finger zooming
  mouseActive = false // when a user presses left click and moves during the press
  minMovementX = 1
  minMovementY = 0.5
  movementX = 0
  movementY = 0
  totalMovementX = 0
  totalMovementY = 0
  touchDeltaX = 0
  touchDeltaY = 0
  touchDeltaZ = 0
  clickEvent: null | ReturnType<typeof setTimeout> = null
  zoom = 0
  /** Clears all previous movement and zoom changes */
  clear (): void {
    this.movementX = 0
    this.movementY = 0
    this.totalMovementX = 0
    this.totalMovementY = 0
    this.zoom = 0
  }

  /** Beginning of a touch event, user has just touched the screen */
  onTouchStart (touches: UserTouchEvent): void {
    this.#setTouchDelta(touches)
    this.mouseActive = true
  }

  /** User has let go, we don't know if it was a swipe, a click, or a double click */
  onTouchEnd (touches: UserTouchEvent): void {
    this.#setTouchDelta(touches)
    if (Math.abs(this.totalMovementX) < this.minMovementX && Math.abs(this.totalMovementY) < this.minMovementY) {
      if (this.clickEvent !== null) {
        clearTimeout(this.clickEvent)
        this.clickEvent = null
        this.dispatchEvent(new Event('doubleClick'))
      } else {
        this.clickEvent = setTimeout(() => {
          this.clickEvent = null
          this.dispatchEvent(new Event('click'))
        }, DOUBLE_CLICK_TIMEOUT)
      }
    }
  }

  /** User is actively moving their fingers */
  #setTouchDelta (touches: UserTouchEvent): void {
    const { length } = touches
    if (length !== 0) {
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

  /** User is using a mouse and just clicked */
  onMouseDown (): void {
    // set to active and set starting movement
    this.mouseActive = true
    this.clear()
  }

  /** User has let go of the left mouse button */
  onMouseUp (posX = 0, posY = 0): void {
    this.mouseActive = false
    // if movement is greater than mins, animate swipe,
    // otherwise if total movement is less than mins it's considered a click
    if (Math.abs(this.movementX) > this.minMovementX || Math.abs(this.movementY) > this.minMovementY) {
      this.dispatchEvent(new Event('swipe'))
    } else if (Math.abs(this.totalMovementX) < this.minMovementX && Math.abs(this.totalMovementY) < this.minMovementY) {
      const click: ClickEvent = { detail: { posX, posY } }
      if (this.clickEvent !== null) {
        clearTimeout(this.clickEvent)
        this.clickEvent = null
        this.dispatchEvent(new CustomEvent('doubleClick', click))
      } else {
        this.clickEvent = setTimeout(() => {
          this.clickEvent = null
          this.dispatchEvent(new CustomEvent('click', click))
        }, DOUBLE_CLICK_TIMEOUT)
      }
    }
  }

  /**
   * tracks movement if the left click actively pressed
   * or it tracks what features are currently active
   */
  onMouseMove (movementX: number, movementY: number): void {
    if (this.mouseActive) {
      this.movementX = movementX
      this.movementY = movementY
      this.totalMovementX += movementX
      this.totalMovementY += movementY
      this.dispatchEvent(new Event('move'))
    }
  }

  /** User is using a touch screen and is actively moving their finger(s) */
  onTouchMove (touches: UserTouchEvent): void {
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
}
