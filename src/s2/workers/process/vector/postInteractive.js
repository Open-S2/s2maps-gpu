// @flow
export default function postInteractiveData (mapID: string, source: string,
  tileID: string, interactiveMap: Map<number, Object>, postMessage: Function) {
  const interactiveGuide = []
  const interactiveData = []

  const textEncoder = new TextEncoder('utf-8')

  let offset = 0
  for (const [id, properties] of interactiveMap) {
    let uint8Array = textEncoder.encode(JSON.stringify(properties))
    let length = uint8Array.length
    interactiveGuide.push(id, offset, offset + length)
    for (const byte of uint8Array) interactiveData.push(byte)
    offset += length
  }

  // Upon building the batches, convert to buffers and ship.
  const interactiveGuideBuffer = new Uint32Array(interactiveGuide).buffer
  const interactiveDataBuffer = new Uint8Array(interactiveData).buffer
  // ship the vector data.
  postMessage({
    mapID,
    type: 'interactivedata',
    source,
    tileID,
    interactiveGuideBuffer,
    interactiveDataBuffer
  }, [interactiveGuideBuffer, interactiveDataBuffer])
}
