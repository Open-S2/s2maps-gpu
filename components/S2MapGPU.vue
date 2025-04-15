<template>
  <div id='map' ref='container'>
    <slot />
  </div>
</template>

<script lang='ts'>
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
    mapReady: Function as PropType<(s2map: S2Map) => void>
  },
  setup ({ mapOptions, mapReady }): { container: Ref<HTMLElement | undefined>, mapInstance: Ref<S2Map | null> } {
    mapOptions = toRaw(mapOptions)
    const container = ref<HTMLElement>()
    const mapInstance = ref<S2Map | null>(null) as Ref<S2Map | null>

    onMounted(async () => {
      const { S2Map } = await import('s2')
      const config = useRuntimeConfig()
      const options: MapOptions = {
        urlMap: {
          apiURL: config.public.dataURL as string,
          dataURL: config.public.dataURL as string,
          baseURL: config.public.baseURL as string
        },
        attributionOff: true,
        watermarkOff: true,
        controls: false,
        ...mapOptions,
        container: container.value
      }
      const map = new S2Map(options)

      /** Used by playwright to ensure the map is ready to render */
      window.testMap = toRaw(map)

      if (typeof mapReady === 'function') map.addEventListener('ready', () => { mapReady(map) }, { once: true })

      mapInstance.value = map
    })

    onUnmounted(() => {
      if (mapInstance.value !== null) mapInstance.value.delete()
    })

    return { container, mapInstance }
  }
}
</script>

<style>
@import url('../assets/styles/s2maps.css');
#map {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
}
</style>
