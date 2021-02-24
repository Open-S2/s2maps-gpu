import React, { useState, useEffect } from 'react'
import { S2Map } from '../s2'
// import StreetStyle from './Streets/style.json'
// import DarkStyle from './Dark/style.json'

function Map (props) {
  const { style, opts } = props
  const { setMap } = useMapContainer(style, opts)
  return (
    <div className='App'>
      <div id='map-container' ref={c => setMap(c)} />
    </div>
  )
}

function useMapContainer (style, opts) {
  let [mapContainer, setMap] = useState()

  // cause a prep of data
  useEffect(() => {
    let map
    if (mapContainer) { map = prepCanvas(mapContainer, style, opts) }
    // componentWillUnmount equivalent:
    return () => { if (map) map.delete() }
  }, [style, opts, mapContainer])

  return { mapContainer, setMap }
}

function prepCanvas (container, style, opts = {}) {
  const map = new S2Map({
    ...opts,
    style,
    container,
    projection: 'blend',
    zoomController: true
  })

  // map.addEventListener('click', (data) => {
  //   console.log('click', data.detail)
  // })
  // map.addEventListener('mouseenter', (data) => {
  //   console.log('mouseenter', data.detail)
  // })
  // map.addEventListener('mouseleave', (data) => {
  //   console.log('mouseleave', data.detail)
  // })

  // setTimeout(() => {
  //   map.jumpTo(-18.287283, 64.920456, 4.4)
  // }, 5000)

  return map
}

export default Map
