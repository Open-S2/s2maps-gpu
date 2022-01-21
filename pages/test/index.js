/* REACT MODULES */
import Map from '../../components/map'
/* JSON */
import style from './style.json'

// function ready (s2map) {
//   setTimeout(() => {
//     s2map.easeTo({ lon: -122.4585607773497, lat: 37.778443127730476, zoom: 0, duration: 1.5, easing: 'ease-in-out' })
//     // s2map.flyTo({ lon: -0.1275, lat: 51.507222, zoom: 10, duration: 20 })
//     // s2map.easeTo()
//   }, 3000)
// }

export default function Streets () {
  return <Map style={style} />
}
