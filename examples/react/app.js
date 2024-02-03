/* MODULES */
import { useEffect, useRef } from 'react'

export default function Map ({ style, opts }) {
  const s2map = useRef()
  const s2mapContainer = useRef()

  useEffect(() => {
    // if no container or already built, return
    if (s2map.current) return
    // prep the canvas
    s2map.current = new window.S2Map({
      ...opts,
      style,
      container: s2mapContainer.current
    })
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
