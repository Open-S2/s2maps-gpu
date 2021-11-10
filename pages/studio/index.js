/* MODULES */
import { useState, useEffect, useRef } from 'react'
/* JSON */
import style from './style.json'
/* STYLESHEET */
import styles from '../../styles/studio.module.css'

const { NEXT_PUBLIC_API_KEY } = process.env

export default function Studio () {
  const [position, setPosition] = useState({ zoom: 0, lon: 0, lat: 0 })

  // cleanup positional data
  let { zoom, lon, lat } = position
  zoom = zoom.toFixed(3)
  while (lon > 180) lon -= 360
  lon = lon.toFixed(5)
  lat = lat.toFixed(5)

  return (
    <div id={styles.studio}>
      <div id={styles.studioHeader}>
        <div id={styles.studioHeaderContainer}>
          <div id={styles.studioHeaderLeft}>
            <div id={styles.studioHeaderJollyRoger} />
            <div id={styles.studioHeaderBack}>Back</div>
          </div>

          <div id={styles.studioHeaderMid}><span id={styles.studioHeaderMidZoom}>{zoom}</span> {lon}, {lat}</div>

          <div id={styles.studioHeaderRight}>
            <div id={styles.studioHeaderSettings} />
            <button id={styles.studioHeaderPublish}>Publish</button>
          </div>
        </div>
      </div>

      <div id={styles.studioBody}>
        <div id={styles.studioBodyEditor} />
        <div id={styles.studioBodySpacer} />
        <Map setPosition={setPosition} />
      </div>

      <div id={styles.studioFooter}>
        <div id={styles.studioFooterLogs} />
        <div id={styles.studioFooterS2Explain}>S2 Maps Inc. ©  {(new Date()).getFullYear()}</div>
      </div>
    </div>
  )
}

function Map ({ setPosition }) {
  const s2map = useRef()
  const s2mapContainer = useRef()

  useEffect(() => {
    // if already built, return
    if (s2map.current) return
    // prep the canvas
    prepCanvas(s2mapContainer.current, s2map, setPosition)
    // componentWillUnmount equivalent:
    return () => {
      if (s2map.current) { s2map.current.delete(); s2map.current = null }
    }
  }, [])

  return <div id={styles.mapContainer} ref={node => { s2mapContainer.current = node }} />
}

function prepCanvas (container, s2map, setPosition) {
  import('../../public/s2').then(({ S2Map }) => {
    s2map.current = new S2Map({
      style,
      container,
      zoomController: true,
      dark: true,
      apiKey: NEXT_PUBLIC_API_KEY
    })
    if (setPosition) {
      s2map.current.addEventListener('pos', data => {
        setPosition(data.detail)
      })
    }
  })
}
