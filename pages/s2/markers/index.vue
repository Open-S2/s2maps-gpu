<template>
  <S2MapGPU :mapOptions="mapOptions" :mapReady="ready" />
</template>

<script setup lang="ts">
import style from './style'
import type { S2Map } from 's2'

function ready (s2map: S2Map): void {
  console.info('ready', s2map)
  s2map.addMarker({ id: 0, lon: 0, lat: 0 })
  setTimeout(() => {
    s2map.removeMarker(0)
    s2map.addMarker({ id: 1, lon: 10, lat: 20 })
  }, 3_000)
}

const mapOptions = { style }
</script>
