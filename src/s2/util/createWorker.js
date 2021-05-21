// @flow

export default function createWorker (url: string, name: string) {
  return new Worker(
    URL.createObjectURL(new Blob([`importScripts('${url}')`], { type: 'text/javascript' })),
    { name }
  )
}
