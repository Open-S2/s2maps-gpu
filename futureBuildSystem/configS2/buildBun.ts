import { version } from '../../package.json'

const result = await Bun.build({
  entrypoints: [
    './s2/index.ts'
    // './s2/ui/s2mapUI.ts',
    // './s2/workers/map.worker.ts',
    // './s2/workers/source.worker.ts',
    // './s2/workers/tile.worker.ts'
  ],
  outdir: './buildS2',
  minify: true,
  sourcemap: 'external',
  splitting: true,
  target: 'browser',
  publicPath: `https://opens2.com/s2maps-gpu/v${version}/`
  // naming: '[name].[ext]'
})

console.log('Build complete', result, version)

export {}
