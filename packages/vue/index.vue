<template>
  <div ref='container'>
    <slot />
  </div>
</template>

<script lang="ts">
import { version } from '../../package.json'
import type { MapOptions, S2Map } from 's2'

export default {
  name: 'S2MapGPU',
  props: {
    mapOptions: {
      type: Object as PropType<MapOptions>,
      required: true
    },
    version: {
      type: String as PropType<string>,
      default: version
    },
    dev: {
      type: Boolean as PropType<boolean>,
      default: false
    },
    testing: {
      type: Boolean as PropType<boolean>,
      default: false
    },
    mapReady: Function as PropType<(s2map: S2Map) => void>
  },
  setup ({ version, mapOptions, dev, testing, mapReady }) {
    mapOptions = toRaw(mapOptions)
    const container = ref<HTMLElement>()
    const mapInstance = ref<S2Map | null>(null)
    const scriptLoaded = ref(false)

    const loadScript = (): void => {
      // TODO: Load CSS as well
      const src = dev === true
        ? `https://opens2.com/s2maps-gpu/${version}/s2maps-gpu.flat.js`
        : `https://opens2.com/s2maps-gpu/${version}/s2maps-gpu.min.js`
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.defer = true
      script.onload = () => {
        scriptLoaded.value = true
        onScriptLoad()
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
        if (dev === true) options.offscreen = false
        const map = new window.S2Map(options)
        mapInstance.value = map
        if (testing === true) window.testMap = map
        if (typeof mapReady === 'function') map.addEventListener('ready', () => { mapReady(map) }, { once: true })
      }
    }

    onMounted(() => {
      if (!scriptLoaded.value) loadScript()
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
  bottom: 0;
  width: 100%;
}
</style>
