/* MODULES */
// import { useEffect, useState } from 'react'
/* REACT MODULES */
import Map from '../../../components/map'
/* STYLES */
// import styles from '../../styles/Countries.module.css'
import style from './style.json'

import type { NextPage } from 'next'

function ready (s2map: S2Map): void {
  // 1) request online status

  // 2) store status data in state

  // 3) send s2maps a point layer with the status data split into:
  //  "operational", ["under_maintenance", "partial_outage"], "major_outage"; green, yellow, red respectively

}

const Cloudflare: NextPage = () => {
  return (
    <div className='pages'>
      <Map
        style={style}
        opts={{ zoomController: false }}
        ready={ready}
        noAPIKey
      />
    </div>
  )
}

export default Cloudflare
