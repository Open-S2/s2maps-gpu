<script lang="ts">
    import { preloadMap } from '../preload.js';
    import { writable } from 'svelte/store';
    import { onDestroy, onMount } from 'svelte';

    import type { BuildType } from '../preload.js';
    import type { MapOptions, S2Map } from 's2/index.js';
  
    export let mapOptions: MapOptions;
    export const mapReady: ((s2map: S2Map) => void) | undefined = undefined;
    export let build: BuildType;
    export const version: string = 'latest';

    const container = writable<HTMLElement>(undefined);
    const mapInstance = writable<S2Map>(undefined);
  
    onMount(async () => {
      await preloadMap(build, version);
      const S2Map = window.S2Map;
      const options: MapOptions = {
        ...mapOptions,
        container: get(container),
      };
      const map = new S2Map(options);
  
      if (mapReady !== undefined) {
        map.addEventListener(
          'ready',
          () => {
            mapReady(map);
          },
          { once: true },
        );
      }
  
      mapInstance.set(map);
    });
  
    onDestroy(() => {
      const map = get(mapInstance);
      if (map !== null) map.delete();
    });
  
    // Helper function to access store value within the script context
    import { get } from 'svelte/store';
</script>

<div id="map" bind:this={$container}>
  <slot />
</div>
  
<style>
    #map {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
    }
</style>