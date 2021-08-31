import React, { useState, useEffect, useRef } from 'react'
import { S2Map } from '../s2'
// import StreetStyle from './Streets/style.json'
// import DarkStyle from './Dark/style.json'

// let s2map = null

const { REACT_APP_API_KEY } = process.env

function Map (props) {
  const s2map = useRef()
  const [height, setHeight] = useState(window.innerHeight)
  const { style, opts, click, ready, info } = props
  for (const source in style.sources) style.sources[source] = style.sources[source].replace('%REACT_APP_S2TILES%', process.env.REACT_APP_S2TILES)
  for (const font in style.fonts) {
    if (style.fonts[font].path) style.fonts[font].path = style.fonts[font].path.replace('%REACT_APP_S2TILES%', process.env.REACT_APP_S2TILES)
    else style.fonts[font] = style.fonts[font].replace('%REACT_APP_S2TILES%', process.env.REACT_APP_S2TILES)
  }

  function resize () { setHeight(window.innerHeight) }

  window.addEventListener('resize', resize, false, 0, true)
  window.addEventListener('orientationchange', resize, false, 0, true)

  useEffect(() => {
    // componentWillUnmount equivalent:
    return () => {
      if (s2map.current) { s2map.current.delete(); s2map.current = null }
    }
  }, [])

  return (
    <div className='App'>
      <div id='map-container' style={{ height }} ref={c => prepCanvas(c, s2map, style, opts, click, ready, info)} />
    </div>
  )
}

function prepCanvas (container, s2map, style, opts = {}, click, ready, info) {
  if (s2map.current) return

  s2map.current = new S2Map({
    ...opts,
    style,
    apiKey: REACT_APP_API_KEY,
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
}

export default Map
