/* MODULES */
import { useEffect, useState } from 'react'
/* REACT MODULES */
import Map from '../../components/map'
import HoverPopup from '../../components/element/hoverPopup'
/* STYLES */
import styles from '../../styles/Countries.module.css'
import style from './style.json'

function ready (s2map) {
  // 1) request online status

  // 2) store status data in state

  // 3) send s2maps a point layer with the status data split into:
  //  "operational", ["under_maintenance", "partial_outage"], "major_outage"; green, yellow, red respectively

}

export default function Cloudflare () {
  const [feature, setFeature] = useState(null)

  const mouseenter = (feature) => { setFeature(feature) }
  const mouseleave = () => { setFeature(null) }
  
  return (
    <div className={styles.countries}>
      <Map
        style={style}
        opts={{ zoomController: false }}
        mouseenter={mouseenter}
        mouseleave={mouseleave}
        ready={ready}
        noAPIKey
      />
      <HoverPopup visible={feature !== null}>
        <div className={styles.popup} style={{ padding: '10px' }}>
          <div className={styles.title}>
            {feature && feature.iso2 && <img className={styles.flag} src={`/images/flags/${feature.iso2.toLowerCase()}.svg`} alt='flag' />}
            <div className={styles.name} style={{ color: '#4d6878' }}>{feature && `${feature.city}, ${feature.country} [${feature.iata}]`}</div>
          </div>         
        </div>
      </HoverPopup>
    </div>
  )
}
