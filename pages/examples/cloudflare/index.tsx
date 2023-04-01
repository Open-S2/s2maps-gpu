/* MODULES */
import React, { useState } from 'react'
/* REACT MODULES */
import Map from '../../../components/map'
import HoverPopup from '../../../components/element/hoverPopup'
/* STYLES */ // @ts-expect-error: why?
import styles from '../../../styles/Countries.module.css'
import style from './style.json'

interface Feature {
  iso2?: string
  city: string
  country: string
  iata: string
}

export default function Cloudflare (): JSX.Element {
  const [feature, setFeature] = useState<Feature>()

  const mouseenter = (feature: Feature): void => { setFeature(feature) }
  const mouseleave = (): void => { setFeature(undefined) }

  return (
    <div className={styles.countries}>
      <Map
        style={style}
        opts={{ zoomController: false }}
        mouseenter={mouseenter}
        mouseleave={mouseleave}
      >
        <HoverPopup visible={feature !== undefined}>
          <div className={styles.popup} style={{ padding: '10px' }}>
            <div className={styles.title}>
              {feature?.iso2 !== undefined && <img className={styles.flag} src={`/images/flags/${feature.iso2.toLowerCase()}.svg`} alt='flag' />}
              <div className={styles.name} style={{ color: '#4d6878' }}>{feature !== undefined && `${feature.city}, ${feature.country} [${feature.iata}]`}</div>
            </div>
          </div>
        </HoverPopup>
      </Map>
    </div>
  )
}
