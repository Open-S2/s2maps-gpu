import React, { useState, useEffect } from 'react'
import { S2Map } from '../s2'

function Map (props) {
  const { style } = props
  const { setMap } = useMapContainer(style)
  return (
    <div className="App">
      <div id="map-container" ref={c => setMap(c)}></div>
    </div>
  )
}

function useMapContainer (style) {
  let [mapContainer, setMap] = useState()

  // cause a prep of data
  useEffect(() => {
    if (mapContainer) { prepCanvas(mapContainer, style) }
  }, [style, mapContainer])

  return { mapContainer, setMap }
}

function prepCanvas(container, style) {
  new S2Map({
    canvasMultiplier: 2,
    style,
    container,
    projection: 'blend'
  })
}

export default Map
