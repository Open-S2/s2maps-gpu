// import React, { useState } from 'react'
import React from 'react'
import Map from '../map'
import style from './style.json'

function Streets () {
  function click (feature, s2map) {
    // if (!feature) return
    // const { id } = feature
    // if (id) s2map.getInfo(id)
  }

  return (
    <div>
      <Map style={style} click={click} />
    </div>
  )
}

export default Streets
