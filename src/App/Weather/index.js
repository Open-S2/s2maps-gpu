import React from 'react'
import Map from '../map'
import style from './style.json'

function Earthquakes () { return <Map style={style} opts={{ darkMode: true }} /> }

export default Earthquakes
