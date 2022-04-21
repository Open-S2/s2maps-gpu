/* REACT MODULES */
import Map from '../../components/map'
/* STYLES */
import style from './style.json'

export default function TemperatureSensor () {
  return (
    <Map
      style={style}
      opts={{ zoomController: false }}
      noAPIKey
    />
  )
}
