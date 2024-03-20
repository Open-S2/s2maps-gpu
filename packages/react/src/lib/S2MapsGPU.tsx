import { useRef, useEffect } from 'react'
import type { MapOptions, S2Map } from 's2maps-gpu'

declare global {
  interface Window { testMap: S2Map }
}

export type BuildType = 'preloaded' | 'flat' | 'prod' | 'dev'

export interface S2MapsGPUProps {
  mapOptions: MapOptions,
  /** Required. version of the map engine you want to use. e.g. "0.14.0" */
  version: string,
  /** Default: 'prod' */
  build?: BuildType,
  /** Default: false */
  testing?: boolean,
  mapReady?: (s2map: S2Map) => void
  children?: React.ReactNode
}

export default function S2MapsGPU ({
  mapOptions,
  version,
  build = 'prod',
  testing = false,
  mapReady,
  children
}: S2MapsGPUProps) {
  const container = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<S2Map | null>(null)
  const scriptLoaded = useRef<boolean>(build === 'preloaded')

  useEffect(() => {
    const initializeMap = async () => {
      if (container.current && !mapInstance.current) {
        // first load the scripts if necessary
        if (!scriptLoaded.current) {
          await loadScript(version, build);
          scriptLoaded.current = true;
        }
        // build the map
        const options: MapOptions = {
          ...mapOptions,
          container: container.current
        }
        const map = new window.S2Map(options);
        mapInstance.current = map;

        if (typeof mapReady === 'function') map.addEventListener('ready', () => { mapReady(map) }, { once: true })
        if (testing) window.testMap = map;
      }
    }
    initializeMap()

    return () => {
      if (mapInstance.current) {
        mapInstance.current.delete();
        mapInstance.current = null;
      }
    };
  }, [mapOptions, version, build, testing, mapReady]);

  return <div ref={container}>{children}</div>
}

async function loadScript (version: string, build: BuildType): Promise<void> {
  return new Promise((resolve, reject) => {
    // load the css
    const cssSrc = build === 'flat'
      ? `https://opens2.com/s2maps-gpu/v${version}/s2maps-gpu.min.css`
      : build === 'dev'
        ? `https://opens2.com/s2maps-gpu/v${version}-local/s2maps-gpu.min.css`
        : `https://opens2.com/s2maps-gpu/v${version}/s2maps-gpu.min.css`
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = cssSrc
    document.head.appendChild(css)
    // Next load the js
    const jsSrc = build === 'flat'
      ? `https://opens2.com/s2maps-gpu/v${version}/s2maps-gpu.flat.js`
      : build === 'dev'
        ? `https://opens2.com/s2maps-gpu/v${version}-local/s2maps-gpu.min.js`
        : `https://opens2.com/s2maps-gpu/v${version}/s2maps-gpu.min.js`
    const script = document.createElement('script')
    script.src = jsSrc
    script.async = true
    script.defer = true
    script.onload = () => { resolve() }
    script.onerror = (err) => {
      console.error('Error loading s2maps-gpu', err)
      reject(err)
    }
    document.head.appendChild(script)
  })
}
