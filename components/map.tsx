/* MODULES */
import React, { useEffect, useRef, useState } from 'react'

import type { S2Map } from '../s2/index'
import type { MapOptions } from '../s2/ui/s2mapUI'

const { NEXT_PUBLIC_API_KEY } = process.env
const { NEXT_PUBLIC_LOCATION } = process.env

export interface MapProps {
  style: Object
  opts: MapOptions
  ready: boolean
  noAPIKey: boolean
  mouseenter: (input: any) => void
  mouseleave: (input: any) => void
}

function Map (props: any): JSX.Element {
  const s2map = useRef<S2Map>()
  const s2mapRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  function resize (): void { setHeight(window.innerHeight) }

  useEffect(() => {
    // if already built, return
    if (s2map.current != null) return
    // prep the canvas
    prepCanvas(s2mapRef.current, s2map, props)
    // prep resizing
    window.addEventListener('resize', resize, false)
    window.addEventListener('orientationchange', resize, false)
    setHeight(window.innerHeight)
    // componentWillUnmount equivalent:
    return () => {
      if (s2map.current != null) { s2map.current.delete(); s2map.current = undefined }
      window.removeEventListener('resize', resize, false)
      window.removeEventListener('orientationchange', resize, false)
    } // eslint-disable-next-line
  }, [])

  return (
    <div>
      <div style={{ height, width: '100%' }} ref={s2mapRef}>
        {props.children}
      </div>
    </div>
  )
}

function prepCanvas (
  container: HTMLDivElement | null,
  s2map: React.MutableRefObject<S2Map | undefined>,
  props: MapProps
): void {
  // pull in properties
  let { style, opts, ready, noAPIKey, mouseenter, mouseleave } = props
  if (!opts) opts = {}
  // don't bother reloading without a style or container
  if (!style || (container == null)) return

  // replace website in sources
  for (const source in style.sources) {
    if (style.sources[source] && typeof style.sources[source] === 'string') style.sources[source] = style.sources[source].replace('{{s2maps}}', NEXT_PUBLIC_LOCATION)
  }

  // build new map
  import('../s2/index').then(({ S2Map }) => {
    s2map.current = new S2Map({
      ...opts,
      style,
      apiKey: noAPIKey ? undefined : NEXT_PUBLIC_API_KEY,
      container,
      projection: 'blend',
      colorBlindController: (typeof opts.zoomController === 'boolean') ? opts.zoomController : true,
      zoomController: (typeof opts.zoomController === 'boolean') ? opts.zoomController : true
    }, ready)
    // assign events
    if (mouseenter !== undefined) {
      s2map.current.addEventListener('mouseenter', (({ detail }: CustomEvent) => mouseenter(detail)) as EventListener)
    }
    if (mouseleave !== undefined) {
      s2map.current.addEventListener('mouseleave', (({ detail }: CustomEvent) => mouseleave(detail)) as EventListener)
    }
  })
    .catch((err) => { throw err })
}

export default Map
