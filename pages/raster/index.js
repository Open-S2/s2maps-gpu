/* REACT MODULES */
import { useState, useEffect, useRef } from 'react'
/* JSON */
import style from './style.json'
/* STYLESHEET */
import styles from '../../styles/raster.module.css'

const { NEXT_PUBLIC_API_KEY } = process.env

export default function Raster () {
  const [month, setMonth] = useState(7)
  const [active, setActive] = useState(false)

  const s2map = useRef()
  const s2mapContainer = useRef()
  const [height, setHeight] = useState(0)

  function resize () { setHeight(window.innerHeight) }

  useEffect(() => {
    // if already built, return
    if (s2map.current) return
    // prep the canvas
    prepCanvas(s2mapContainer.current, s2map)
    // prep resizing
    window.addEventListener('resize', resize, false, 0, true)
    window.addEventListener('orientationchange', resize, false, 0, true)
    setHeight(window.innerHeight)
    // componentWillUnmount equivalent:
    return () => {
      if (s2map.current) { s2map.current.delete(); s2map.current = null }
    }
  }, [])

  const monthDropdown = (
    <div id={styles.rasterDropdownContent}>
      {
        [...Array(12).keys()].map(num => {
          return (
            <div
              className={num === month ? 'raster-gray' : 'raster-drop'}
              key={num}
              onClick={() => {
                if (num !== month) {
                  setMonth(num)
                  style.sources.satellite = `s2maps://data/s2maps/modis-v1/${num}.s2tiles`
                  s2map.current.setStyle(style)
                }
              }}
            >
              {toMonth(num)}
            </div>
          )
        })
      }
    </div>
  )

  return (
    <div>
      <div id='mapContainer' style={{ height }} ref={node => { s2mapContainer.current = node }} />
      <div id={styles.rasterDropdownContainer} onClick={() => { setActive(!active) }}>
        <div id={styles.rasterDropdown}>Set Current Month: {toMonth(month)}</div>
        {active ? monthDropdown : null}
      </div>
    </div>
  )
}

function prepCanvas (container, s2map) {
  import('../../public/s2').then(({ S2Map }) => {
    s2map.current = new S2Map({
      style,
      container,
      zoomController: true,
      dark: true,
      apiKey: NEXT_PUBLIC_API_KEY
    })
  })
}

function toMonth (month: number): string {
  switch (month) {
    case 0: return 'January'
    case 1: return 'February'
    case 2: return 'March'
    case 3: return 'April'
    case 4: return 'May'
    case 5: return 'June'
    case 6: return 'July'
    case 7: return 'August'
    case 8: return 'September'
    case 9: return 'October'
    case 10: return 'November'
    case 11:
    default: return 'December'
  }
}
