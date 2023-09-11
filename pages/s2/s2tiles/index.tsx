/* MODULES */
import React from 'react'
// import { useEffect, useState } from 'react'
/* REACT MODULES */
import Map from '../../../components/map'
/* STYLES */
import styles from '../../styles/Countries.module.css'
import style from './style.json'

import type { NextPage } from 'next'
// import type { S2Map } from '../../../s2'

const S2Tiles: NextPage = () => {
  return (
    <div className={styles.countries}>
      <Map
        style={style}
        opts={{ zoomController: false }}
      />
    </div>
  )
}

export default S2Tiles
