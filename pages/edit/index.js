/* REACT MODULES */
import Map from '../map'
/* JSON */
import style from './style.json'

export default function Edit () { return <Map opts={{ darkMode: true, zoomController: false, attributionOff: true }} style={style} /> }
