<template>
  <S2MapGPU :mapOptions="mapOptions" :mapReady="ready" />
</template>

<script setup lang="ts">
import style from './style'
import type { S2Map } from 's2'

function ready (s2map: S2Map): void {
  console.info('ready', s2map)
  s2map.setDarkMode(true)
  // s2map.screenshot().then((dataUrl) => {
  //   console.info('screenshot', dataUrl)
  // }).catch((error) => {
  //   console.error('screenshot', error)
  // })
}

const mapOptions = { style }
</script>
