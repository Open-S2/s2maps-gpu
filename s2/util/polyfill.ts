// @ts-nocheck
export const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
export const isChrome = /chrome/i.test(navigator.userAgent)
/* eslint-env browser */
/* Safari and Edge polyfill for createImageBitmap
 * https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/createImageBitmap
 */
// TODO: Get this working again. Something changed and runs this file before window is accessable
// if (!('createImageBitmap' in window) || isSafari) {
//   window.createImageBitmap = async function (blob: Blob | MediaSource) {
//     return await new Promise((resolve) => {
//       const img = document.createElement('img')
//       img.addEventListener('load', function () { resolve(this) })
//       img.src = URL.createObjectURL(blob)
//       img.deleteURL = function () { URL.revokeObjectURL(this.src) }
//     })
//   }
// }

/** Opera Mini polyfill
  * https://caniuse.com/?search=requestAnimationFrame
  */
// if (!('requestAnimationFrame' in window)) {
//   window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 1000 / 60)
// }
