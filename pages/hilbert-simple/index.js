/* REACT MODULES */
import Map from '../../components/map'
import { toLonLat } from 's2projection/s2Point'
/* JSON */
import style from './style.json'

// min: 0.05
const POS = {
  lon: 0,
  lat: 0,
  velLon: 0.3,
  velLat: 0.5
}

function ready (s2map) {
  const animate = () => {
    requestAnimationFrame(animate)
    // increment
    POS.lon += POS.velLon
    POS.lat += POS.velLat
    // wrap
    if (POS.lon > 180) POS.lon -= 360
    if (POS.lat > 180) POS.lat -= 360
    // update
    s2map.jumpTo(POS.lon, POS.lat)
  }

  animate()
}

// 91 -> 89
// 170 -> 10
// 180 -> 0
// 90 - (lat - 90)

export default function Hilbert () {
  return <Map
    style={style}
    opts={{ zoomController: false, noClamp: true }}
    ready={ready}
    noAPIKey
  />
}
