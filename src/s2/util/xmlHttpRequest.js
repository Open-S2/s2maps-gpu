// @flow
export type Extension = 'pbf' | 'json' | 'png' | 'jpeg'

export default function requestData (path: string, extension: Extension, callback: Function) {
  const oReq = new XMLHttpRequest()

  oReq.responseType = getResposeType(extension)
  oReq.onload = () => { callback(oReq.response) }
  oReq.onerror = (e) => { console.log('ERROR', e); callback(null) }
  oReq.open('GET', `${path}.${extension}`)
  oReq.setRequestHeader('cache-control', `max-age=${2721600}`) // 4.5 * 7 * 24 * 60 * 60 seconds (1 month ish)
  oReq.send()
}

function getResposeType (extension: Extension) {
  if (extension === 'json' || extension === 'geojson' || extension === 's2json') return 'json'
  else if (extension === 'png' || extension === 'jpeg' || extension === 'jpg' || extension === 'webp') return 'blob'
  else return 'arraybuffer' // 'pbf' | etc.
}
