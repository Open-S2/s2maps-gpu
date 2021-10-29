/* MODULES */
import { useState, useEffect, useRef } from 'react'

const { NEXT_PUBLIC_API_KEY } = process.env

function Map (props) {
  const s2map = useRef()
  const s2mapContainer = useRef()
  const [height, setHeight] = useState(0)
  const { style, opts, click, ready, info } = props
  if (!style) return null
  for (const source in style.sources) style.sources[source] = style.sources[source].replace('%NEXT_PUBLIC_S2TILES%', process.env.NEXT_PUBLIC_S2TILES)
  for (const font in style.fonts) {
    if (style.fonts[font].path) style.fonts[font].path = style.fonts[font].path.replace('%NEXT_PUBLIC_S2TILES%', process.env.NEXT_PUBLIC_S2TILES)
    else style.fonts[font] = style.fonts[font].replace('%NEXT_PUBLIC_S2TILES%', process.env.NEXT_PUBLIC_S2TILES)
  }

  function resize () { setHeight(window.innerHeight) }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    // if already built, return
    if (s2map.current) return
    // prep the canvas
    prepCanvas(s2mapContainer.current, s2map, style, opts, click, ready, info)
    // prep resizing
    window.addEventListener('resize', resize, false, 0, true)
    window.addEventListener('orientationchange', resize, false, 0, true)
    setHeight(window.innerHeight)
    // componentWillUnmount equivalent:
    return () => {
      if (s2map.current) { s2map.current.delete(); s2map.current = null }
    }
  }, [])

  return (
    <div className='App'>
      <div id='mapContainer' style={{ height }} ref={node => s2mapContainer.current = node} />
    </div>
  )
}

function prepCanvas (container, s2map, style, opts = {}, click, ready, info) {
  import('../public/s2').then(({ S2Map }) => {
    s2map.current = new S2Map({
      ...opts,
      style,
      apiKey: NEXT_PUBLIC_API_KEY,
      container,
      projection: 'blend',
      zoomController: (typeof opts.zoomController === 'boolean') ? opts.zoomController : true
    })

    if (ready) ready(s2map.current)

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

    // s2map.current.addEventListener('mouseenter', (data) => {
    //   console.log('mouseenter', data.detail)
    // })
    // s2map.current.addEventListener('mouseleave', (data) => {
    //   console.log('mouseleave', data.detail)
    // })

    // setTimeout(() => {
    //   s2map.current.jumpTo(-18.287283, 64.920456, 4.4)
    // }, 5000)
  })
}

export default Map
