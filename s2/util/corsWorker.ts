/* eslint-env browser */
declare const process: {
  env: {
    NEXT_PUBLIC_DEV: string
  }
}

export class CorsWorker extends Worker {
  constructor (url: URL, options?: { name: string, type: 'module' }) {
    if (+process.env.NEXT_PUBLIC_DEV === 1) {
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
