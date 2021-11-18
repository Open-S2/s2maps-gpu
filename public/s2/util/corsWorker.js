// @flow
/* eslint-env browser */
export default class CorsWorker extends Worker {
  constructor (url: URL, options?: { name: string, type: 'module' }) {
    if (!!+process.env.NEXT_PUBLIC_DEV) {
      super(url, options)
    } else {
      const webpackWorkerOrigin = `__webpack_worker_origin__ = ${JSON.stringify(
        url.origin
      )}`
      const importScripts = `importScripts(${JSON.stringify(url.toString())})`
      const objectURL = URL.createObjectURL(
        new Blob([`${webpackWorkerOrigin};\n${importScripts}`], {
          type: 'application/javascript'
        })
      )
      super(objectURL, options)
      URL.revokeObjectURL(objectURL)
    }
  }
}
