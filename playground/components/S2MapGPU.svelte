<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { MapOptions, S2Map } from 's2';

  // --- Props ---
  const { mapOptions, mapReady, children } = $props<{
    mapOptions: MapOptions;
    mapReady?: (s2map: S2Map) => void;
    children?: Snippet;
  }>();

  // --- Internal State ---
  let container = $state<HTMLElement | undefined>(undefined);
  let mapInstance = $state<S2Map | undefined>(undefined);

  $effect(() => {
    let map: S2Map | undefined = undefined; // Temporary reference for cleanup robustness
    /** Initialize the map */
    async function initializeMap() {
      const { S2Map } = await import('s2');

      const options: MapOptions = {
        urlMap: {
          baseURL: 'http://localhost:3000',
          dataURL: 'http://localhost:3000',
          apiURL: 'http://localhost:3000/api',
        },
        attributionOff: true,
        watermarkOff: true,
        controls: false,
        ...mapOptions,
        container,
      };

      mapInstance = map = new S2Map(options);

      if (typeof mapReady === 'function') {
        map.addEventListener(
          'ready',
          () => {
            mapReady(map!);
          },
          { once: true },
        );
      }
    }

    void initializeMap();

    return () => {
      const mapToDelete = mapInstance ?? map;
      mapToDelete?.delete();
      mapInstance = undefined;
    };
  });
</script>

<div id="map" bind:this={container}>
  {@render children?.()}
</div>

<style>
  @import '../../s2/s2maps.css';
  #map {
    /* Condensed style */
    position: absolute;
    top: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
  }
</style>
