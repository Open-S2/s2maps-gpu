<template>
  <div id="app">
    <S2MapGPU :map-options="mapOptions" :map-ready="ready" />
  </div>
</template>

<script setup lang="ts">
import S2MapGPU from '../components/S2MapGPU.vue';
import { importStyle } from '../importStyle';

import type { MapOptions, Projection, S2Map } from 's2';

const searchParams = new URLSearchParams(window.location.search);
const projection = (searchParams.get('projection')?.toUpperCase() ?? 'S2') as Projection;
const context = searchParams.get('context') ?? 'webgl2';
const styleName = searchParams.get('style') ?? 'background';
// get the style
const mapStyle = importStyle(projection, styleName);

/**
 * S2Map Ready Callback
 * @param s2map - the S2Map
 */
function ready(s2map: S2Map): void {
  console.info('ready', s2map);
  // void s2map.awaitFullyRendered().then(() => {
  //   console.info('fully rendered')
  // })
}

const mapOptions: MapOptions = {
  style: mapStyle,
  contextType: context === 'dom' ? 0 : context === 'webgl' ? 1 : context === 'webgl2' ? 2 : 3,
};
</script>

<style>
body {
  padding: 0;
  margin: 0;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    Segoe UI,
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    Fira Sans,
    Droid Sans,
    Helvetica Neue,
    sans-serif;
}
#app {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
}
</style>
