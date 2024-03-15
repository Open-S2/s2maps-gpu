<template>
  <S2MapGPU v-if="mapOptions !== undefined" :mapOptions=mapOptions :mapReady="ready" />
</template>

<script setup lang="ts">
import type { MapOptions, S2Map } from 's2'

const mapOptions = ref<MapOptions>()

function ready (s2map: S2Map): void {
  console.info('ready', s2map)
  // s2map.awaitFullyRendered().then(() => {
  //   console.info('awaitFullyRendered worked!')
  // }).catch((error) => {
  //   console.error('awaitFullyRendered failed: ', error)
  // })
}

onMounted(async () => {
  const { default: style } = await import ('./style')
  mapOptions.value = { style }
})
</script>
