import React from 'react'
import Map from '../map'
import style from './style.json'

function Dark () { return <Map style={style} opts={{ darkMode: true }} /> }

export default Dark
