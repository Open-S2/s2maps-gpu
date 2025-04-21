<template>
  <div id="map" ref="container">
    <slot />
  </div>
</template>

<script lang="ts">
import { preloadMap } from '../preload.js';
import { onMounted, onUnmounted, ref, shallowRef, toRaw } from 'vue';

import { BuildType } from '../preload.js';
import type { MapOptions, S2Map } from 's2/index.js';
import type { PropType, Ref } from 'vue';

/** The exported container and mapInstance */
export interface S2MapVueComponent {
  container: Ref<HTMLElement | undefined>;
  mapInstance: Ref<S2Map | null>;
}

/**
 * # The S2MapGPU Vue Component
 *
 * TODO: Describe how to use the component. Also explain the install function for global access
 */
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
    build: {
      type: String as PropType<BuildType>,
      required: true,
    },
    version: {
      type: String as PropType<string>,
      required: false,
      default: 'latest',
    },
    testing: {
      type: Boolean as PropType<boolean>,
      required: false,
      default: false,
    },
  },
  /**
   * Setup the component, map instance, and mounting/unmounting config
   * @param props - Props passed to the component
   * @returns container and mapInstance
   */
  setup(props): S2MapVueComponent {
    let { mapOptions, mapReady, build, version, testing } = props;
    mapOptions = toRaw(mapOptions);
    const container = ref<HTMLElement>();
    const mapInstance = shallowRef<S2Map | null>(null);

    onMounted(async () => {
      await preloadMap(build, version);
      const S2Map = window.S2Map;
      const options: MapOptions = {
        ...mapOptions,
        container: container.value,
      };
      const map = new S2Map(options);
      if (testing === true) window.testMap = map;

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
