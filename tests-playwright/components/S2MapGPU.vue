<template>

  <div id="map" ref="container"> <slot /> </div>

</template>

<script lang="ts">
import { S2Map } from 's2/index.js';
import { onMounted, onUnmounted, ref, toRaw } from 'vue';

import type { MapOptions } from 's2/index.ts';
import type { PropType, Ref } from 'vue';

declare global {
  /** Expose the testMap to global scope for testing purposes */
  interface Window {
    testMap: S2Map;
  }
}

/** The exported container and mapInstance */
export interface S2MapComponent {
  container: Ref<HTMLElement | undefined>;
  mapInstance: Ref<S2Map | null>;
}

/** Test Map component for Playwright */
export default {
  name: 'S2MapGPU',
  props: {
    mapOptions: {
      type: Object as PropType<MapOptions>,
      required: true,
    },
  },
  /**
   * Input props are just the map options
   * @param props - Props passed to the component
   * @returns container and mapInstance
   */
  setup(props): S2MapComponent {
    let { mapOptions } = props;
    mapOptions = toRaw(mapOptions);
    const container = ref<HTMLElement>();
    const mapInstance = ref<S2Map | null>(null) as Ref<S2Map | null>;

    onMounted((): void => {
      const options: MapOptions = {
        urlMap: {
          baseURL: 'http://localhost:3030',
          dataURL: 'http://localhost:3030',
        },
        attributionOff: true,
        watermarkOff: true,
        controls: false,
        ...mapOptions,
        container: container.value,
      };
      const map = new S2Map(options);

      /** Used by playwright to ensure the map is ready to render */
      window.testMap = toRaw(map);

      mapInstance.value = map;
    });

    onUnmounted(() => {
      if (mapInstance.value !== null) mapInstance.value.delete();
    });

    return { container, mapInstance };
  },
};
</script>

<style>
@import url('../../s2/s2maps.css');
#map {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
}
</style>

