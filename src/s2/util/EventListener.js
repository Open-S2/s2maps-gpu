// @flow
// This is polyfill class for Safari as they do not support EventTarget as a constructor
export default class EventListener {
  listeners = {}

  addEventListener (type, callback) {
    if (!(type in this.listeners)) {
      this.listeners[type] = []
    }
    this.listeners[type].push(callback)
  }

  removeEventListener (type, callback) {
    if (!(type in this.listeners)) return
    let stack = this.listeners[type];
    for (let i = 0, l = stack.length; i < l; i++) {
      if (stack[i] === callback) {
        stack.splice(i, 1)
        return
      }
    }
  }

  dispatchEvent (event) {
    if (!(event.type in this.listeners)) return true
    let stack = this.listeners[event.type].slice()
    for (let i = 0, l = stack.length; i < l; i++) stack[i].call(this, event)
    return !event.defaultPrevented
  }
}
