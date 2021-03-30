// @flow
export type Extension = 'pbf' | 'json' | 'png' | 'jpeg' | 'geojson' | 's2json' | 'jpg' | 'webp'

export default function requestData (path: string, extension: Extension, callback: Function, ab?: boolean = false) {
  const resType = getResposeType(extension)

  fetch(`${path}.${extension}`)
    .then(res => {
      if (res.status !== 200 && res.status !== 206) return null
      else if (ab) return res.arrayBuffer()
      else if (resType === 'json') return res.json()
      else if (resType === 'blob') return res.blob()
      else return res.arrayBuffer()
    })
    .then(data => callback(data))
    .catch(err => { console.log('ERROR', err) })
}

function getResposeType (extension: Extension) {
  if (extension === 'json' || extension === 'geojson' || extension === 's2json') return 'json'
  else if (extension === 'png' || extension === 'jpeg' || extension === 'jpg' || extension === 'webp') return 'blob'
  else return 'arraybuffer' // 'pbf' | etc.
}
