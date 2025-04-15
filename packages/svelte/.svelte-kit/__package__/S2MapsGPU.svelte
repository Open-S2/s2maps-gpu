<script>import { onMount, onDestroy } from "svelte";
export let mapOptions;
export let version;
export let build = "prod";
export let testing = false;
export let mapReady = void 0;
let container;
let mapInstance = null;
let scriptLoaded = false;
const loadScript = () => {
  const cssSrc = build === "flat" ? `https://opens2.com/s2maps-gpu/v${version}/s2maps-gpu.min.css` : build === "dev" ? `https://opens2.com/s2maps-gpu/v${version}-local/s2maps-gpu.min.css` : `https://opens2.com/s2maps-gpu/v${version}/s2maps-gpu.min.css`;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = cssSrc;
  document.head.appendChild(css);
  const jsSrc = build === "flat" ? `https://opens2.com/s2maps-gpu/v${version}/s2maps-gpu.flat.js` : build === "dev" ? `https://opens2.com/s2maps-gpu/v${version}-local/s2maps-gpu.min.js` : `https://opens2.com/s2maps-gpu/v${version}/s2maps-gpu.min.js`;
  const script = document.createElement("script");
  script.src = jsSrc;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    scriptLoaded = true;
    onScriptLoad();
  };
  script.onerror = (err) => {
    console.error("Error loading s2maps-gpu", err);
  };
  document.head.appendChild(script);
};
const onScriptLoad = () => {
  if (container !== void 0 && mapInstance === null) {
    const options = {
      ...mapOptions,
      container
    };
    if (build === "flat")
      options.offscreen = false;
    const map = new window.S2Map(options);
    mapInstance = map;
    if (testing)
      window.testMap = map;
    if (typeof mapReady === "function")
      map.addEventListener("ready", () => {
        mapReady(map);
      }, { once: true });
  }
};
onMount(() => {
  if (build === "preloaded")
    scriptLoaded = true;
  if (!scriptLoaded)
    loadScript();
  else
    onScriptLoad();
});
onDestroy(() => {
  if (mapInstance !== null)
    mapInstance.delete();
});
</script>

<div id='map' bind:this={container}>
  <slot />
</div>

<style>
  #map {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
  }
</style>
