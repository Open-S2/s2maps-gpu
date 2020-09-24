// @flow
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
