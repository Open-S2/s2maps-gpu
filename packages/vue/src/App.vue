<script setup lang="ts">
import S2MapGPU from './components/S2MapsGPU.vue'
import style from './assets/style'

import type { MapOptions } from 's2maps-gpu'

const mapOptions: MapOptions = { style }
</script>

<template>
  <S2MapGPU version="0.13.0" :mapOptions="mapOptions" />
</template>
