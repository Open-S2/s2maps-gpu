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
  else if (extension === 'json') return 'json'
  else if (extension === 'png' || extension === 'jpeg') return 'blob'
  else return 'arraybuffer'
}
