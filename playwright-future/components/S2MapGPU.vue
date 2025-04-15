<template>
  <div id='map' ref='container'>
    <slot />
  </div>
</template>

<script lang='ts'>
import type { MapOptions, S2Map as S2MapType } from 's2'

declare global {
  interface Window { testMap: S2MapType }
}

export default {
  name: 'S2MapGPU',
  props: {
    mapOptions: {
      type: Object as PropType<MapOptions>,
      required: true
    }
  },
  setup ({ mapOptions }): { container: Ref<HTMLElement | undefined>, mapInstance: Ref<S2MapType | null> } {
    mapOptions = toRaw(mapOptions)
    const container = ref<HTMLElement>()
    const mapInstance = ref<S2MapType | null>(null) as Ref<S2MapType | null>

    onMounted(async () => {
      const options: MapOptions = {
        urlMap: {
          baseURL: 'http://localhost:8080',
          dataURL: 'http://localhost:8080'
        },
        attributionOff: true,
        watermarkOff: true,
        controls: false,
        ...mapOptions,
        container: container.value,
        // TODO: When flat build can handle offscreen, remove this
        offscreen: false
      }
      const map = new window.S2Map(options)

      /** Used by playwright to ensure the map is ready to render */
      window.testMap = toRaw(map)

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
/* @import url('../../assets/styles/s2maps.css'); */
#map {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
}
</style>
