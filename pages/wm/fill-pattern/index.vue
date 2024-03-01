<template>
  <S2MapGPU :mapOptions="mapOptions" :mapReady="ready" />
</template>

<script setup lang="ts">
import style from './style'
import type { S2Map } from 's2'

function ready (s2map: S2Map): void {
  console.info('ready', s2map)
}

const mapOptions = { style }
</script>
