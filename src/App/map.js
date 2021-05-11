import React, { useState, useEffect } from 'react'
import { S2Map } from '../s2'
// import StreetStyle from './Streets/style.json'
// import DarkStyle from './Dark/style.json'

let s2map = null

function Map (props) {
  const [height, setHeight] = useState(window.innerHeight)
  const { style, opts, click, ready } = props

  function resize () { setHeight(window.innerHeight) }

  window.addEventListener('resize', resize)
  window.addEventListener('orientationchange', resize)

  useEffect(() => {
    // componentWillUnmount equivalent:
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
      if (s2map) { s2map.delete(); s2map = null }
    }
  }, [])

  return (
    <div className='App'>
      <div id='map-container' style={{ height }} ref={c => prepCanvas(c, style, opts, click, ready)} />
    </div>
  )
}

function prepCanvas (container, style, opts = {}, click, ready) {
  if (s2map) return

  s2map = new S2Map({
    ...opts,
    style,
    apiKey: 's2.sdfjsdlfjdslfjsdlkfj.sdfsdfsdfsdf',
    container,
    projection: 'blend',
    zoomController: true
  })

  if (ready) ready(s2map)

  if (click) {
    s2map.addEventListener('click', (data) => {
      // console.log('click', data.detail)
      click(data.detail)
    })
  }

  // s2map.addEventListener('mouseenter', (data) => {
  //   console.log('mouseenter', data.detail)
  // })
  // s2map.addEventListener('mouseleave', (data) => {
  //   console.log('mouseleave', data.detail)
  // })

  // setTimeout(() => {
  //   s2map.jumpTo(-18.287283, 64.920456, 4.4)
  // }, 5000)
}

export default Map
