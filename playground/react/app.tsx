import React from 'react';
import { S2MapGPU } from '../components/S2MapGPU';
import { createRoot } from 'react-dom/client';
import { importStyle } from '../importStyle';
// style
import '../../s2/s2maps.css';

import type { MapOptions, Projection, S2Map } from 's2';

const searchParams = new URLSearchParams(window.location.search);
const projection = (searchParams.get('projection')?.toUpperCase() ?? 'S2') as Projection;
const context = searchParams.get('context') ?? 'webgl2';
const styleName = searchParams.get('style') ?? 'background';
const mapStyle = importStyle(projection, styleName);

const mapOptions: MapOptions = {
  style: mapStyle,
  contextType: context === 'webgl' ? 1 : context === 'webgl2' ? 2 : 3,
};

/**
 * S2Map Ready Callback
 * @param s2map - the S2Map
 */
function ready(s2map: S2Map): void {
  console.info('ready', s2map);
  // s2map.awaitFullyRendered().then(() => console.info('fully rendered'));
}

const root = createRoot(document.getElementById('app')!);
root.render(<S2MapGPU mapOptions={mapOptions} mapReady={ready} />);
