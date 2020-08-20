import React, { useState, useEffect } from 'react'
import { S2Map } from '../../s2'
import style from './style.json'

function Raster () {
  const { setMap } = useMapContainer()
  return (
    <div className="App">
      <div id="map-container" ref={c => setMap(c)}></div>
    </div>
  )
}

function useMapContainer () {
  let [mapContainer, setMap] = useState()

  // cause a prep of data
  useEffect(() => {
    if (mapContainer) { prepCanvas(mapContainer) }
  }, [mapContainer])

  return { mapContainer, setMap }
}

function prepCanvas(container) {
  new S2Map({
    canvasMultiplier: 2,
    style,
    container,
    projection: 'blend'
  })
}

export default Raster
