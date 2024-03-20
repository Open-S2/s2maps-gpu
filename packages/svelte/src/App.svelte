<script lang="ts">
  import S2MapsGPU from './lib/S2MapsGPU.svelte'
  import type { MapOptions } from 's2maps-gpu'

  import style from './assets/style'

  const mapOptions: MapOptions = { style }
</script>

<main>
  <S2MapsGPU
    {mapOptions}
    version="0.13.0"
  />
</main>

<style>
</style>
