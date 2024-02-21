/* MODULES */
import React from 'react'
/* REACT MODULES */
import Map from '../../../components/map'
/* STYLES */
import { style } from './maplibreStyle'
/* TOOLS */
import styleConverter from '../../../tools/styleConverter'

import type { S2Map } from '../../../s2'

function ready (s2map: S2Map): void {
  console.info('ready', s2map)
}

const style2 = styleConverter(style)

export default function Fill (): React.JSX.Element {
  return (
    <div className='pages'>
      <Map
        style={style2}
        opts={{ zoomController: false, contextType: 3 }}
        ready={ready}
        noAPIKey
      />
    </div>
  )
}
