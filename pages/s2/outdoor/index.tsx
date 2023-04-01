/* MODULES */
// import { useEffect, useState } from 'react'
/* REACT MODULES */
import Map from '../../../components/map'
/* STYLES */
import styles from '../../styles/Countries.module.css'
import style from './style.json'

import type { NextPage } from 'next'

const StreetsExample: NextPage = () => {
  return (
    <div className={styles.countries}>
      <Map
        style={style}
        opts={{ zoomController: false }}
      />
    </div>
  )
}

export default StreetsExample
