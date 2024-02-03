/* MODULES */
import React from 'react'
/* REACT MODULES */
import Map from '../../../components/map'
/* STYLES */
import style from './style'

import type { S2Map } from '../../../s2'

function ready (s2map: S2Map): void {
  // s2map.addMarker({ id: 1, lon: -42.55096026164184, lat: -34.06835417261842 })
  console.info('ready', s2map)
}

export default function Streets (): React.JSX.Element {
  return (
    <div className='pages'>
      <Map
        style={style}
        opts={{ zoomController: false, contextType: 2 }}
        ready={ready}
        noAPIKey
      />
    </div>
  )
}
