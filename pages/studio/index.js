/* MODULES */
import { useState, useEffect, useRef } from 'react'
import Layers from '../../components/layers'
/* JSON */
import style from './style.json'
/* STYLESHEET */
import styles from '../../styles/studio.module.css'

const { NEXT_PUBLIC_API_KEY } = process.env

export default function Studio () {
  const s2map = useRef()
  const [position, setPosition] = useState({ zoom: 0, lon: 0, lat: 0 })
  const [studioStyle, setStudioStyle] = useState(prepStyle(style))

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
        <div id={styles.studioBodyEditor}>
          {style && <Layers style={studioStyle} setStyle={setStudioStyle} s2map={s2map} />}
          <div id={styles.editorController} />
        </div>
        <div id={styles.studioBodySpacer} />
        <Map setPosition={setPosition} s2map={s2map} />
      </div>

      <div id={styles.studioFooter}>
        <div id={styles.studioFooterLogs} />
        <div id={styles.studioFooterS2Explain}>S2 Maps Inc. ©  {(new Date()).getFullYear()}</div>
      </div>
    </div>
  )
}

function Map ({ setPosition, s2map }) {
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
  }, [s2map, setPosition])

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

function prepStyle (style) {
  // layers
  if (!style.layers) style.layers = []
  // name
  if (!style.name) style.name = 's2maps-new-v1'
  // center
  if (!style.center) style.center = [0, 0]
  // zoom
  if (!style.zoom) style.zoom = 0
  // minzoom
  if (!style.minzoom) style.minzoom = -1
  // maxzoom
  if (!style.maxzoom) style.maxzoom = 18.99
  // maxLatRotation
  if (!style.maxLatRotation) style.maxLatRotation = 85
  // colorBlind
  if (!style.colorBlind) style.colorBlind = false
  // zoomController
  if (!style.zoomController) style.zoomController = true
  // interactive
  if (!style.interactive) style.interactive = true
  // scrollZoom
  if (!style.scrollZoom) style.scrollZoom = true
  // canMove
  if (!style.canMove) style.canMove = true
  // canZoom
  if (!style.canZoom) style.canZoom = true
  // attributions
  if (!style.attributions) style.attributions = []
  // studio groups
  if (!style.groups) style.groups = {}

  return prepStudio(JSON.parse(JSON.stringify(style)))
}

function prepStudio (style) {
  // prep styling
  style.layers.forEach((layer, index) => {
    const { name, type, source, paint } = layer
    // setup color
    if (paint && paint.color && typeof paint.color === 'string') layer._color = paint.color
    // setup type
    if (type === 'fill' && source === 'mask') layer._type = 'mask'
    else layer._type = type
    // setup name
    layer._name = name || `[${index}] - (${type})`
    // setup index
    layer._index = index
    layer._indexOld = index
  })

  // TODO: setup groups

  return style
}
