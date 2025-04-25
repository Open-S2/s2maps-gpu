<script lang="ts">
  import { preloadMap } from '../preload.js';

  import type { BuildType } from '../preload.js';
  import type { Snippet } from 'svelte';
  import type { MapOptions, S2Map as S2MapType } from 's2/index.js'; // Type aliased

  // --- Props ---
  const { mapOptions, build, version, mapReady, children } = $props<{
    mapOptions: MapOptions;
    build: BuildType;
    version?: string;
    mapReady?: (s2map: S2MapType) => void;
    children?: Snippet;
  }>();

  // --- Internal State ---
  let containerEl = $state<HTMLElement | undefined>(undefined);
  let mapInstance = $state<S2MapType | undefined>(undefined);

  // --- Map Initialization and Cleanup Effect ---
  $effect(() => {
    // Guard: Requires the container element to be rendered
    if (containerEl === undefined) return;

    let map: S2MapType | undefined = undefined; // Temporary reference for cleanup robustness
    let aborted = false; // Prevent race conditions on cleanup/re-run

    /** Initialize the map */
    async function initializeMap() {
      // Preload map assets - ensure this is idempotent or safe if deps cause re-run
      await preloadMap(build, version);
      if (aborted || containerEl === undefined) return; // Abort if component destroyed/re-rendering after await

      const S2MapConstructor = window.S2Map;
      if (S2MapConstructor === undefined) {
        console.error('S2Map constructor not found on window object.');
        return;
      }
      // Create map instance
      map = new S2MapConstructor({ ...mapOptions, container: containerEl });
      mapInstance = map;

      if (mapReady !== undefined) {
        map.addEventListener(
          'ready',
          () => {
            if (!aborted && mapInstance === map) {
              mapReady(map);
            }
          },
          { once: true },
        );
      }
    }

    void initializeMap();

    // Cleanup function (runs on unmount or before effect re-runs)
    return () => {
      aborted = true;
      const mapToClean = mapInstance ?? map; // Use state instance or local if state update didn't happen
      if (mapToClean !== undefined) {
        mapToClean.delete();
      }
      mapInstance = undefined; // Ensure state is reset
    };
  });
</script>

<template>
  <div id="map" bind:this={containerEl}>
    {@render children?.()}
  </div>
</template>

<style>
  #map {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
  }
</style>
