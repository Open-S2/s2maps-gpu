/* eslint-env browser */
/* MODULES */
import { useState } from 'react'
/* REACT MODULES */
import Card from './card'
import Map from '../map'
/* JSON */
import style from './style.json'

export default function Interact () {
  const [info, setInfo] = useState(null)
  const [display, setDisplay] = useState(false)

  function ready (map) {
    function geoSuccess (position) {
      const { longitude, latitude } = position.coords
      map.jumpTo(longitude, latitude, 7)
    }

    try {
      navigator.geolocation.getCurrentPosition(geoSuccess)
    } catch (_) {}
  }

  function click (feature) {
    if (!feature) return

    const { locationID } = feature

    if (locationID) {
      setInfo(null)
      setDisplay(true)
      fetch(`https://data.s2maps.io/public/demos/tesla/location-data/${locationID}.json`)
        .then(response => response.json())
        .then(data => setInfo(data))
    }
  }

  function close () {
    setDisplay(false)
  }

  return (
    <div>
      <Map style={style} click={click} ready={ready} />
      <Card display={display} info={info} close={close} />
    </div>
  )
}
