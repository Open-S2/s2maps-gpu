<script lang="ts">
  import S2MapGPU from '../components/S2MapGPU.svelte';
  import { importStyle } from '../importStyle';

  import type { MapOptions, Projection, S2Map } from 's2';

  const searchParams = new URLSearchParams(window.location.search);
  const projection = (searchParams.get('projection')?.toUpperCase() ?? 'S2') as Projection;
  const context = searchParams.get('context') ?? 'webgl2';
  const styleName = searchParams.get('style') ?? 'background';
  const mapStyle = importStyle(projection, styleName);

  const mapOptions: MapOptions = {
    style: mapStyle,
    contextType: context === 'dom' ? 0 : context === 'webgl' ? 1 : context === 'webgl2' ? 2 : 3,
  };

  /**
   * S2Map Ready Callback
   * @param s2map - the S2Map
   */
  function mapReady(s2map: S2Map): void {
    console.info('ready', s2map);
    // s2map.awaitFullyRendered().then(() => console.info('fully rendered'));
  }
</script>

<div id="app">
  <S2MapGPU {mapOptions} {mapReady} />
</div>

<style>
  #app {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
  }
</style>
