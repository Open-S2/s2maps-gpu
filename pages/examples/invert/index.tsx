/* MODULES */
import React from 'react'
/* REACT MODULES */
import Map from '../../../components/map'
/* STYLES */ // @ts-expect-error: why?
import styles from '../../../styles/Countries.module.css'
import style from './style.json'

export default function Invert (): JSX.Element {
  return (
    <div className={styles.countries}>
      <Map
        style={style}
        opts={{ zoomController: false }}
      />
    </div>
  )
}
