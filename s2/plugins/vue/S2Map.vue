<template>
  <div id="map" ref="container">
    <slot />
  </div>
</template>

<script lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, toRaw } from 'vue';

import type { MapOptions, S2Map } from 's2';
import type { PropType, Ref } from 'vue';

/** The exported container and mapInstance */
export interface S2MapComponent {
  container: Ref<HTMLElement | undefined>;
  mapInstance: Ref<S2Map | null>;
}

// TODO: PROP build type: 'preloaded' | 'flat' | 'prod' = 'prod'
// - flat requests a flat version which doesn't require fetching workers seperately
// - preloaded means the map is already loaded into the window object
// - prod is the default which requests the map and css seperately

export default {
  name: 'S2MapGPU',
  props: {
    mapOptions: {
      type: Object as PropType<MapOptions>,
      required: true,
    },
    mapReady: {
      type: Function as PropType<(s2map: S2Map) => void>,
      required: false,
      default: undefined,
    },
  },
  /**
   * Setup the component, map instance, and mounting/unmounting config
   * @param props - Props passed to the component
   * @returns container and mapInstance
   */
  setup(props): S2MapComponent {
    let { mapOptions, mapReady } = props;
    mapOptions = toRaw(mapOptions);
    const container = ref<HTMLElement>();
    const mapInstance = shallowRef<S2Map | null>(null);

    onMounted(async () => {
      const { S2Map } = await import('s2');
      const options: MapOptions = {
        ...mapOptions,
        container: container.value,
      };
      const map = new S2Map(options);

      if (typeof mapReady === 'function')
        map.addEventListener(
          'ready',
          () => {
            mapReady(map);
          },
          { once: true },
        );

      mapInstance.value = map;
    });

    onUnmounted(() => {
      if (mapInstance.value !== null) mapInstance.value.delete();
    });

    return { container, mapInstance };
  },
};
</script>

<style scoped>
#map {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
}
</style>
<style>
@import url('../../s2/s2maps.css');
</style>
