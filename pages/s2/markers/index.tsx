/* MODULES */
// import { useEffect, useState } from 'react'
/* REACT MODULES */
import Map from '../../../components/map'
import Slider from 'react-input-slider'
/* STYLES */
import styles from '../../styles/Countries.module.css'
import style from './style.json'

function ready (s2map: S2Map): void {
  s2map.addMarker({ id: 0, lon: 0, lat: 0 })
  // setTimeout(() => {
  //   s2map.removeMarker(0)
  //   s2map.addMarker({ id: 1, lon: 10, lat: 20 })
  // }, 3_000)
}

export default function Cloudflare (): JSX.Element {
  return (
    <div className={styles.countries}>
      <Map
        style={style}
        opts={{ zoomController: false }}
        ready={ready}
      />
    </div>
  )
}
