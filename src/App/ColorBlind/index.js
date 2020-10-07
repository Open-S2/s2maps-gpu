import React from 'react'
import Map from '../map'
import style from '../Streets/style.json'

style.colorBlind = true

function ColorBlind () { return <Map style={style} /> }

export default ColorBlind
