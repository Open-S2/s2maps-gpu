import { version } from 'package.json'
import GlslPlugin from 'config/glsl-loader/bun'
import WgslPlugin from 'config/wgsl-loader/bun'
// import InlineWorkerPlugin from 'config/inline-worker-plugin'

const result = await Bun.build({
  entrypoints: [
    './s2/index.ts',
    './s2/ui/s2mapUI.ts',
    './s2/workers/map.worker.ts',
    './s2/workers/source.worker.ts',
    './s2/workers/tile.worker.ts'
  ],
  outdir: './buildS2-flat',
  minify: true,
  sourcemap: 'external',
  splitting: false,
  target: 'browser',
  plugins: [GlslPlugin, WgslPlugin],
  publicPath: `https://opens2.com/s2maps-gpu/v${version}/`
  // naming: '[name].[ext]'
})

console.info('Build complete', result, version)

export {}
