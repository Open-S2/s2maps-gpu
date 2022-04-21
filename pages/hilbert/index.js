/* REACT MODULES */
import Map from '../../components/map'
/* JSON */
import style from './style.json'

function onReady (map) {
  setTimeout(() => {
    map.addMarker({ id: 1, lon: -42.55096026164184, lat: -34.06835417261842 })
  }, 2000)
}

export default function Hilbert () {
  return <Map style={style} ready={onReady} />
}
