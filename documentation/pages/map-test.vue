<script setup lang="ts">
import { VueS2MapGPU } from 's2maps-gpu/frameworks'
import type { MapOptions, StyleDefinition } from 's2maps-gpu'
// setup map style
const style: StyleDefinition = {
  version: 1,
  name: 'S2 Hilbert',
  view: {
    lon: -90,
    lat: 0,
    zoom: -0.4
  },
  minzoom: -1,
  maxzoom: 2.5,
  sources: {
    hilbert: '/s2json/hilbert.s2json'
  },
  layers: [
    {
      name: 'hilbert_path',
      source: 'hilbert',
      filter: {
        and: [
          { key: 'class', value: 'hilbert', comparator: '==' },
          { key: 'level', value: 4, comparator: '==' }
        ]
      },
      type: 'line',
      cap: 'butt',
      join: 'bevel',
      color: '#475569',
      width: 3
    }
  ]
}
const mapOptions: MapOptions = { style, offscreen: false }
</script>

<template>
  <div>
    <VueS2MapGPU :map-options=mapOptions build="flat" />
  </div>
</template>
