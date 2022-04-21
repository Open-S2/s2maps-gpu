/* MODULES */
import { useState, useRef, useEffect } from 'react'

const { NEXT_PUBLIC_API_KEY } = process.env
const { NEXT_PUBLIC_LOCATION } = process.env

function Map (props) {
  const s2map = useRef()
  const s2mapContainer = useRef()
  const [height, setHeight] = useState(0)

  function resize () { setHeight(window.innerHeight) }

  useEffect(() => {
    // if already built, return
    if (s2map.current) return
    // prep the canvas
    prepCanvas(s2mapContainer.current, s2map, props)
    // prep resizing
    window.addEventListener('resize', resize, false, 0, true)
    window.addEventListener('orientationchange', resize, false, 0, true)
    setHeight(window.innerHeight)
    // componentWillUnmount equivalent:
    return () => {
      if (s2map.current) { s2map.current.delete(); s2map.current = null }
      window.removeEventListener('resize', resize, false, 0, true)
      window.removeEventListener('orientationchange', resize, false, 0, true)
    } // eslint-disable-next-line
  }, [])

  return (
    <div>
      <div style={{ height, width: '100%' }} ref={node => { s2mapContainer.current = node }} />
    </div>
  )
}

function prepCanvas (container, s2map, props) {
  // pull in properties
  let { style, opts, click, ready, info, mouseenter, mouseleave, noAPIKey } = props
  if (!opts) opts = {}
  // don't bother reloading without a style or container
  if (!style || !container) return

  // replace website in sources
  for (const source in style.sources) {
    if (style.sources[source] && typeof style.sources[source] === 'string') style.sources[source] = style.sources[source].replace('{{s2maps}}', NEXT_PUBLIC_LOCATION)
  }

  // build new map
  import('../public/s2').then(({ S2Map }) => {
    s2map.current = new S2Map({
      ...opts,
      style,
      apiKey: noAPIKey ? null : NEXT_PUBLIC_API_KEY,
      container,
      projection: 'blend',
      colorBlindController: (typeof opts.zoomController === 'boolean') ? opts.zoomController : true,
      zoomController: (typeof opts.zoomController === 'boolean') ? opts.zoomController : true,
      ready
    })
    // create the appropriate even listeners
    if (click) {
      s2map.current.addEventListener('click', (data) => {
        const { feature, lon, lat } = data.detail
        click(feature, lon, lat, s2map.current)
      })
    }
    if (info) {
      s2map.current.addEventListener('info', (data) => {
        // console.log('click', data.detail)
        info(data.detail, s2map.current)
      })
    }
    if (mouseenter) {
      s2map.current.addEventListener('mouseenter', (data) => {
        // console.log('click', data.detail)
        mouseenter(data.detail, s2map.current)
      })
    }
    if (mouseleave) {
      s2map.current.addEventListener('mouseleave', (data) => {
        // console.log('click', data.detail)
        mouseleave(data.detail, s2map.current)
      })
    }
  })
}

export default Map
