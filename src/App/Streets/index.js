import React from 'react'
import Map from '../map'
import style from './style.json'

function Streets () { return <Map style={style} opts={{ infoLayers: ['country_state'] }} /> }

export default Streets
