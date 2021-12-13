/* REACT MODULES */
import Map from '../../components/map'
/* JSON */
import style from './style.json'

export default function Dark () { return <Map style={style} opts={{ darkMode: true }} /> }
