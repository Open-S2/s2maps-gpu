import type { View } from 'ui/camera/projector/index.js';

/**
 * Sets the hash in the location bar given the current view
 * @param view - The current camera view
 */
export function setHash(view: Required<View>): void {
  const { bearing, pitch } = view;
  let { lon, lat, zoom } = view;
  zoom = Math.round(zoom * 100) / 100;
  // derived from equation: 512px * 2^z / 360 / 10^d < 0.5px
  const precision = Math.ceil((zoom * Math.LN2 + Math.log(512 / 360 / 0.5)) / Math.LN10);
  const m = Math.pow(10, precision);
  lon = Math.round(lon * m) / m;
  lat = Math.round(lat * m) / m;
  let hash = `#${zoom}/${lon}/${lat}`;

  if (bearing !== 0) hash += `/${Math.round(bearing * 10) / 10}`;
  if (pitch !== 0) hash += `/${Math.round(pitch)}`;

  // set hash on the location bar
  const location = window.location.href.replace(/(#.+)?$/, hash);
  window.history.replaceState(window.history.state, '', location);
}

/** @returns The current view converted from the hash */
export function parseHash(): View {
  const view: View = {};
  const [, hash] = window.location.href.split('#');
  // corner case: no hash
  if (hash === undefined) return view;
  // parse hash
  const [zoom, lon, lat, bearing, pitch] = hash.split('/') as [
    zoom: string,
    lon: string,
    lat: string,
    bearing: string | undefined,
    pitch: string | undefined,
  ];
  view.zoom = parseFloat(zoom);
  view.lon = parseFloat(lon);
  view.lat = parseFloat(lat);
  if (bearing !== undefined) view.bearing = parseFloat(bearing);
  if (pitch !== undefined) view.pitch = parseFloat(pitch);

  return view;
}
