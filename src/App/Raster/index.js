import React, { useState, useEffect, useRef } from 'react'
import { S2Map } from '../../s2'
import style from './style.json'

import './raster.css'

function Raster () {
  const [month, setMonth] = useState(7)
  const [active, setActive] = useState(false)
  const [mapContainer, setMap] = useState()
  let map = useRef(null)

  // cause a prep of data
  useEffect(() => {
    if (mapContainer) { map.current = prepCanvas(mapContainer, { darkMode: true }) }
    // componentWillUnmount equivalent:
    return () => { if (map.current) map.current.delete() }
  }, [mapContainer])

  const monthDropdown = <div id="raster-dropdown-content">
    {
      [...Array(12).keys()].map(num => {
        return <div className={num === month ? 'raster-gray' : 'raster-drop'} key={num} onClick={() => {
          if (num !== month) {
            setMonth(num)
            style.sources.satellite.path = `https://s3.s2maps.io/modis-v1/${num}`
            map.current.setStyle(style)
          }
        }}>{toMonth(num)}</div>
      })
    }
  </div>

  return <div>
    <div id='map-container' ref={c => setMap(c)} />
    <div id="raster-dropdown-container" onClick={() => { setActive(!active) }}>
      <div id="raster-dropdown">Set Current Month: {toMonth(month)}</div>
      {active ? monthDropdown : null}
    </div>
  </div>
}

function prepCanvas (container, opts = {}) {
  const map = new S2Map({
    ...opts,
    style,
    container,
    projection: 'blend',
    zoomController: true
  })

  return map
}

function toMonth (month: number): string {
  switch (month) {
    case 0: return 'January'
    case 1: return 'February'
    case 2: return 'March'
    case 3: return 'April'
    case 4: return 'May'
    case 5: return 'June'
    case 6: return 'July'
    case 7: return 'August'
    case 8: return 'September'
    case 9: return 'October'
    case 10: return 'November'
    case 11:
    default: return 'December'
  }
}

export default Raster
