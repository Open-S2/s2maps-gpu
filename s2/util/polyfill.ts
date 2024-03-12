// /** Build a window polyfill if necessary */
// if (typeof window === 'undefined') {
//   // @ts-expect-error - add a window object to the global object
//   global.window = global
//   // defualt a few properties
//   global.devicePixelRatio = 2
//   // setup adapter
// }

export const isSafari = /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent)
/* Safari and Edge polyfill for createImageBitmap
 * https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/createImageBitmap
 */
// NOTE: I don't think this is required anymore.
// if (!('createImageBitmap' in window) || isSafari) {
//   window.createImageBitmap = async function (blob: Blob | MediaSource): Promise<ImageBitmap> {
//     return await new Promise((resolve) => {
//       const img = document.createElement('img')
//       img.addEventListener('load', function () { resolve(this) })
//       img.src = URL.createObjectURL(blob)
//       img.deleteURL = function () { URL.revokeObjectURL(this.src) }
//     })
//   }
// }

// export interface NodeCanvasElement {
//   native: true
//   width: number
//   height: number
//   style: Record<string, string>
//   clientWidth: number
//   clientHeight: number
//   appendChild: (element: NodeCanvasElement) => void
//   removeChild: (element: NodeCanvasElement) => void
//   addEventListener: (event: string, callback: (event: Event) => void) => void
//   removeEventListener: (event: string, callback: (event: Event) => void) => void
//   getBoundingClientRect: () => DOMRect
//   getContext: (contextId: 'webgl' | 'experimental-webgl' | 'webgl2' | 'webgpu') => GPUCanvasContext | null
//   transferControlToOffscreen: undefined
// }

// /** For Node/Bun/Deno runs, we need to expose some functionality to emulate some browser mechanics */
// export function buildCanvas (): NodeCanvasElement {
//   return {
//     native: true,
//     width: 0,
//     height: 0,
//     style: {},
//     clientWidth: 0,
//     clientHeight: 0,
//     appendChild: (_element: NodeCanvasElement): void => {},
//     removeChild: (_element: NodeCanvasElement): void => {},
//     addEventListener: (_event: string, _callback: (event: Event) => void) => {},
//     removeEventListener: (_event: string, _callback: (event: Event) => void) => {},
//     getBoundingClientRect: function (): DOMRect {
//       return {
//         x: 0,
//         y: 0,
//         width: this.width,
//         height: this.height,
//         top: 0,
//         right: 0,
//         bottom: 0,
//         left: 0,
//         toJSON: () => ''
//       }
//     },
//     getContext: function (contextId: 'webgl' | 'experimental-webgl' | 'webgl2' | 'webgpu'): GPUCanvasContext | null {
//       if (contextId === 'webgpu') {
//         return {
//           __brand: 'GPUCanvasContext',
//           canvas: this as unknown as HTMLCanvasElement,
//           configure (
//             configuration: GPUCanvasConfiguration
//           ): undefined {},
//           unconfigure (): undefined {},
//           getCurrentTexture (): GPUTexture {
//             return undefined as unknown as GPUTexture
//           }
//         }
//       }
//       return null
//     },
//     transferControlToOffscreen: undefined
//   }
// }
