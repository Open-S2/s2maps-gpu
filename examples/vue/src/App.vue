<template>
<div id="app">
  <div id='map' ref='container'></div>
</div>
</template>

<script>
// create access token
const accessToken = 'eyJ1IjoidGVzdHVzZXIiLCJpIjoiTFZwaWFSWUlyRnFKbndRTDlpR3RYIn0.QKwZXimsJ0ivyhlJBEutX5QHiPhbd6fpt9YafOYcmaZPnba0yO5ndnHUzjIRtCDTPGJRs8QdOzMOvuFHxtkZMg'
// setup map style
const style = {
  'version': 1,
  'name': 'raster-demo',
  'center': [0, 0],
  'zoom': -0.5,
  'minzoom': -1.5,
  'maxzoom': 5.25,
  'zoom-offset': 0.5,
  'sources': {
    'satellite': 's2maps://data/s2maps/modis-v1/7.s2tiles'
  },
  'wallpaper': {
    'skybox': 'https://data.s2maps.io/public/backgrounds/milkyway',
    'loadingBackground': 'rgb(9, 8, 17)',
    'size': 2048,
    'type': 'webp'
  },
  'layers': [
    {
      'name': 'background',
      'type': 'fill',
      'source': 'mask',
      'layout': {},
      'paint': {
        'color': 'rgb(9, 8, 17)'
      }
    },
    {
      'name': 'sat',
      'source': 'satellite',
      'type': 'raster'
    },
    {
      'name': 'shade',
      'source': 'mask',
      'type': 'shade',
      'maxzoom': 2
    }
  ]
}
export default {
  mounted () {
    const container = this.$refs['container']
    // create the map
    // eslint-disable-next-line
    new S2Map({
      style,
      apiKey: accessToken,
      container,
      zoomController: true
    })
  }
}
</script>

<style>
body {
  margin: 0;
  padding: 0;
}
#map {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
}
</style>
