/* MODULES */
import React, { useEffect, useRef, useState } from 'react'

import type { S2Map, StyleDefinition } from '../s2/index'
import type { MapOptions } from '../s2/ui/s2mapUI'

export type Ready = (s2map: S2Map) => void

export interface MapProps {
  style?: StyleDefinition
  opts?: Omit<MapOptions, 'style'>
  ready?: Ready
  noAPIKey?: boolean
  mouseenter?: (input?: unknown) => void
  mouseleave?: (input?: unknown) => void
  children?: React.ReactNode
}

function Map (props: MapProps): JSX.Element {
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
    }
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
  const { style, opts, ready, mouseenter, mouseleave } = props
  // don't bother reloading without a style or container
  if (style === undefined || (container == null)) return

  // build new map
  import('../s2/index').then(({ S2Map }) => {
    s2map.current = new S2Map({
      ...(opts ?? {}),
      style,
      apiKey: undefined,
      container,
      // projection: 'blend',
      // colorBlindController: (typeof opts.zoomController === 'boolean') ? opts.zoomController : true,
      zoomController: opts?.zoomController
    })
    // assign events
    if (mouseenter !== undefined) {
      s2map.current.addEventListener('mouseenter', (
        ({ detail }: CustomEvent) => { mouseenter(detail) }
      ) as EventListener)
    }
    if (mouseleave !== undefined) {
      s2map.current.addEventListener('mouseleave', (
        ({ detail }: CustomEvent) => { mouseleave(detail) }) as EventListener
      )
    }
    if (ready !== undefined) {
      s2map.current.addEventListener('ready', (
        ({ detail }: CustomEvent) => { ready(detail) }
      ) as EventListener)
    }
  })
    .catch((err) => { throw err })
}

export default Map
