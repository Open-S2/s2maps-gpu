// @flow
/* eslint-env browser */
/* Safari and Edge polyfill for createImageBitmap
 * https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/createImageBitmap
 */
if (!('createImageBitmap' in window)) {
  window.createImageBitmap = async function (blob) {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img')
      img.addEventListener('load', function () { resolve(this) })
      img.src = URL.createObjectURL(blob)
    })
  }
}

// TODO:
// Every time you are finished with a url created by URL.createObjectURL,
// you need to call URL.revokeObjectURL

/** Opera Mini polyfill
  * https://caniuse.com/?search=requestAnimationFrame
  */
if (!('requestAnimationFrame' in window)) {
  window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 1000 / 60)
}

/** polyfill for quite a few browsers
  * https://caniuse.com/?search=requestAnimationFrame
  */
// if (!('ResizeObserver' in window)) {
//   window.ResizeObserver = ResizeObserver
// }

// This is polyfill class for Safari as it does not support EventTarget as a constructor
// pulled from https://github.com/ungap/event-target/blob/master/index.js
const self = this || {}
try {
  self.EventTarget = new EventTarget()
} catch (EventTarget) {
  (function (Object, wm) {
    const create = Object.create
    const defineProperty = Object.defineProperty
    const proto = EventTarget.prototype
    define(proto, 'addEventListener', function (type, listener, options) {
      const secret = wm.get(this)
      const listeners = secret[type] || (secret[type] = [])
      for (let i = 0, length = listeners.length; i < length; i++) {
        if (listeners[i].listener === listener) return
      }
      listeners.push({ target: this, listener: listener, options: options })
    })
    define(proto, 'dispatchEvent', function (event) {
      const secret = wm.get(this)
      const listeners = secret[event.type]
      if (listeners) {
        define(event, 'target', this)
        define(event, 'currentTarget', this)
        listeners.slice(0).forEach(dispatch, event)
        delete event.currentTarget
        delete event.target
      }
      return true
    })
    define(proto, 'removeEventListener', function (type, listener) {
      for (let
        secret = wm.get(this),
        /* istanbul ignore next */
        listeners = secret[type] || (secret[type] = []),
        i = 0, length = listeners.length; i < length; i++
      ) {
        if (listeners[i].listener === listener) {
          listeners.splice(i, 1)
          return
        }
      }
    })
    self.EventTarget = EventTarget
    function EventTarget () {
      wm.set(this, create(null))
    }
    function define (target, name, value) {
      defineProperty(
        target,
        name,
        {
          configurable: true,
          writable: true,
          value: value
        }
      )
    }
    function dispatch (info) {
      const options = info.options
      if (options && options.once) info.target.removeEventListener(this.type, info.listener)
      if (typeof info.listener === 'function') info.listener.call(info.target, this)
      else info.listener.handleEvent(this)
    }
  }(Object, new WeakMap()))
}
