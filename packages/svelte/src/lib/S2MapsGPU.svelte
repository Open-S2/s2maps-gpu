<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { MapOptions, S2Map } from 's2maps-gpu'

  export let mapOptions: MapOptions
  export let version: string
  export let build: 'preloaded' | 'flat' | 'prod' | 'dev' = 'prod'
  export let testing: boolean = false
  export let mapReady: ((s2map: S2Map) => void) | undefined = undefined

  let container: HTMLElement
  let mapInstance: S2Map | null = null
  let scriptLoaded: boolean = false

  const loadScript = (): void => {
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
    if (build === 'flat') script.type = 'module'
    script.src = jsSrc
    script.async = true
    script.defer = true
    script.onload = () => {
      scriptLoaded = true
      onScriptLoad()
    }
    script.onerror = (err) => {
      console.error('Error loading s2maps-gpu', err)
    }
    document.head.appendChild(script)
  }

  const onScriptLoad = (): void => {
    if (container !== undefined && mapInstance === null) {
      const options: MapOptions = {
        ...mapOptions,
        container
      }
      // TODO: When flat build can handle offscreen, remove this
      if (build === 'flat') options.offscreen = false
      const map = new window.S2Map(options)
      mapInstance = map
      // @ts-expect-error - creating a new variable
      if (testing === true) window.testMap = map
      if (typeof mapReady === 'function') map.addEventListener('ready', () => { mapReady(map) }, { once: true })
    }
  }

  onMount(() => {
    // if the map is already loaded into the window object, set the scriptLoaded value to true
    if (build === 'preloaded') scriptLoaded = true
    // if the script is not loaded, load the script
    if (!scriptLoaded) loadScript()
    // if the script is loaded, build the map
    else onScriptLoad()
  })

  onDestroy(() => {
    if (mapInstance !== null) mapInstance.delete()
  })
</script>

<div id='map' bind:this={container}>
  <slot />
</div>

<style>
  #map {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
  }
</style>
