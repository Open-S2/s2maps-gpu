<template>
  <S2MapGPU :mapOptions="mapOptions" :mapReady="ready" />
</template>

<script setup lang="ts">
import style from './style'
import type { MapOptions, S2Map } from 's2'

function ready (s2map: S2Map): void {
  console.info('ready', s2map)
  // s2map.addMarker({ id: 0, lon: 0, lat: 0 }, 'markers')
  // setTimeout(() => {
  //   s2map.removeMarker(0)
  //   s2map.addMarker({ id: 1, lon: 10, lat: 20 })
  // }, 3_000)
  s2map.awaitFullyRendered().then(() => {
    console.info('awaitFullyRendered worked!')
  }).catch((error) => {
    console.error('awaitFullyRendered failed: ', error)
  })
}

const mapOptions: MapOptions = { style }
</script>
