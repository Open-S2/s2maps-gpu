import React from 'react'
import Map from '../map'
import style from './style.json'

function CountryPoints () { return <Map style={style} opts={{ zoomController: false }} /> }

export default CountryPoints
