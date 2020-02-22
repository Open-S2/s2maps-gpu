// @flow
export type Extension = 'pbf' | 'json' | 'png' | 'jpeg'

export default function requestData (path: string, extension: Extension, callback: Function) {
  const oReq = new XMLHttpRequest()

  oReq.onload = (e) => {
    callback(oReq.response)
  }
  oReq.onerror = () => { callback(null) }
  oReq.open('GET', `${path}.${extension}`)
  oReq.responseType = getResposeType(extension)
  oReq.send()
}

function getResposeType (extension: Extension) {
  if (extension === 'pbf') return 'arraybuffer'
  else if (extension === 'json' || extension === 'geojson' || extension === 's2json') return 'json'
  else return 'arraybuffer'
}
