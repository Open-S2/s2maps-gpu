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
      img.deleteURL = function () { URL.revokeObjectURL(this.src) }
    })
  }
}

/** Opera Mini polyfill
  * https://caniuse.com/?search=requestAnimationFrame
  */
// if (!('requestAnimationFrame' in window)) {
//   window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 1000 / 60)
// }
