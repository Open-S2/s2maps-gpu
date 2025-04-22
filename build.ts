import GlslPlugin from './config/glsl-loader/bun.js';
import WgslPlugin from './config/wgsl-loader/bun.js';
// import inlineWorkerPlugin from './config/inline-worker-plugin/index.ts';
import { rmSync } from 'node:fs';
import { version } from './package.json' with { type: 'json' };

import { filesize } from 'filesize';
import { statSync } from 'fs';

rmSync('./buildS2-local', { recursive: true, force: true });

await Bun.build({
  entrypoints: [
    './s2/index.ts',
    './s2/workers/map.worker.ts',
    './s2/workers/source.worker.ts',
    './s2/workers/tile.worker.ts',
  ],
  outdir: './buildS2-local',
  minify: false,
  sourcemap: 'external',
  splitting: true,
  target: 'browser',
  publicPath: `https://opens2.com/s2maps-gpu/v${version}/`,
  // naming: '[name]-[hash].[ext]',
  naming: '[name].[ext]',
  plugins: [
    GlslPlugin,
    WgslPlugin,
    // // @ts-expect-error - this actually works.
    // inlineWorkerPlugin({
    //   target: 'esnext',
    //   // plugins: [GlslPlugin, WgslPlugin]
    // }),
  ],
});

const fileSize = filesize(statSync('./buildS2-local/index.js').size);
console.info('FILE SIZE: ', fileSize);
