/* REACT MODULES */
import Map from '../../components/map'
/* JSON */
import style from './style.json'

// function ready (s2map) {
//   // setTimeout(() => {
//   //   // s2map.easeTo({ lon: 20, lat: 20, zoom: 1.01, duration: 1.5, easing: 'ease-in-out' })
//   //   s2map.flyTo({ lon: -0.1275, lat: 51.507222, zoom: 10, duration: 20 })
//   //   // s2map.easeTo()
//   // }, 5000)
// }

export default function Streets () {
  return <Map style={style} opts={{ infoLayers: ['country_state'] }} />
}
