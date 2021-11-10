/* MODULES */
import { useEffect, useRef } from 'react'
/* GRAB THE API KEY */
const { NEXT_PUBLIC_API_KEY } = process.env

export default function Map ({ style, opts }) {
  const s2map = useRef()
  const s2mapContainer = useRef()

  useEffect(() => {
    // if already built, return
    if (s2map.current) return
    // prep the canvas
    prepCanvas(s2mapContainer.current, s2map, style, opts)
    // componentWillUnmount equivalent:
    return () => {
      if (s2map.current) { s2map.current.delete(); s2map.current = null }
    }
  }, [])

  return (
    <div className='App'>
      <div id='mapContainer' ref={node => { s2mapContainer.current = node }} />
    </div>
  )
}

function prepCanvas (container, s2map, style, opts = {}) {
  s2map.current = new S2Map({
    ...opts,
    style,
    apiKey: NEXT_PUBLIC_API_KEY,
    container
  })
}
