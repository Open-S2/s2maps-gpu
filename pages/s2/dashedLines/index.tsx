/* MODULES */
import React from 'react'
/* REACT MODULES */
import Map from '../../../components/map'
/* STYLES */
import style from './style'

import type { S2Map } from '../../../s2'

function ready (s2map: S2Map): void {
  console.info('ready', s2map)
}

export default function Lines (): React.JSX.Element {
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