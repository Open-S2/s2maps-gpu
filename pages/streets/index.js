/* REACT MODULES */
import Map from '../map'
/* JSON */
import style from './style.json'

export default function Streets () { return <Map style={style} opts={{ infoLayers: ['country_state'] }} /> }
