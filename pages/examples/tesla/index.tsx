/* MODULES */
import React from 'react'
/* REACT MODULES */
import Map from '../../../components/map'
/* STYLES */
import styles from '../../../styles/Countries.module.css'
import style from './style.json'

export default function Tesla (): JSX.Element {
  return (
    <div className={styles.countries}>
      <Map
        style={style}
        opts={{ zoomController: false }}
      />
    </div>
  )
}
