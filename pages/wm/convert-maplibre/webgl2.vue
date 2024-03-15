<template>
  <S2MapGPU v-if="mapOptions !== undefined" :mapOptions=mapOptions :mapReady="ready" />
</template>

<script setup lang="ts">
import type { MapOptions, S2Map } from 's2'

const mapOptions = ref<MapOptions>()

function ready (s2map: S2Map): void {
  console.info('ready', s2map)
}

onMounted(async () => {
  const { default: style } = await import ('./style')
  mapOptions.value = { style, contextType: 2 }
})
</script>
