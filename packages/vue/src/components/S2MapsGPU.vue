<template>
  <div ref='container'>
    <slot />
  </div>
</template>

<script lang="ts">
import { onMounted, onUnmounted, ref, toRaw } from 'vue'

import type { PropType } from 'vue'
import type { MapOptions, S2Map } from 's2'

declare global {
  interface Window { testMap: S2Map }
}

export default {
  name: 'S2MapGPU',
  props: {
    mapOptions: {
      type: Object as PropType<MapOptions>,
      required: true
    },
    version: {
      type: String as PropType<string>,
      required: true
    },
    build: {
      type: String as PropType<'preloaded' | 'flat' | 'prod' | 'dev'>,
      default: 'prod'
    },
    testing: {
      type: Boolean as PropType<boolean>,
      default: false
    },
    mapReady: Function as PropType<(s2map: S2Map) => void>
  },
  setup ({ version, mapOptions, build, testing, mapReady }) {
    mapOptions = toRaw(mapOptions)
    const container = ref<HTMLElement>()
    const mapInstance = ref<S2Map | null>(null)
    const scriptLoaded = ref<boolean>(false)

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
        scriptLoaded.value = true
        onScriptLoad()
      }
      script.onerror = (err) => {
        console.error('Error loading s2maps-gpu', err)
      }
      document.head.appendChild(script)
    }

    const onScriptLoad = (): void => {
      if (container.value !== undefined && mapInstance.value === null) {
        const options: MapOptions = {
          ...mapOptions,
          container: container.value
        }
        // TODO: When flat build can handle offscreen, remove this
        if (build === 'flat') options.offscreen = false
        const map = new window.S2Map(options)
        mapInstance.value = map
        if (testing) window.testMap = map
        if (typeof mapReady === 'function') map.addEventListener('ready', () => { mapReady(map) }, { once: true })
      }
    }

    onMounted(() => {
      // if the map is already loaded into the window object, set the scriptLoaded value to true
      if (build === 'preloaded') scriptLoaded.value = true
      // if the script is not loaded, load the script
      if (!scriptLoaded.value) loadScript()
      // if the script is loaded, buiild the map
      else onScriptLoad()
    })

    onUnmounted(() => {
      if (mapInstance.value !== null) mapInstance.value.delete()
    })

    return { container, mapInstance }
  }
}
</script>

<style>
#map {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
}
</style>
