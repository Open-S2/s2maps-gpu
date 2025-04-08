<template>
  <S2MapGPU :mapOptions="mapOptions" :mapReady="ready" />
</template>

<script setup lang="ts">
import style from './style'
import { useRoute } from 'vue-router'

import type { MapOptions, S2Map } from 's2'

let contextType: undefined | 1 | 2 | 3

const route = useRoute()
const { slug } = route.params
if (Array.isArray(slug)) {
  const [name] = slug
  if (name === 'webgl') contextType = 1
  else if (name === 'webgl2') contextType = 2
  else if (name === 'webgpu') contextType = 3
}

function ready (s2map: S2Map): void {
  console.info('ready', s2map)
  // void s2map.awaitFullyRendered().then(() => {
  //   console.info('fully rendered')
  // })
}

const mapOptions: MapOptions = { style, contextType }
</script>
