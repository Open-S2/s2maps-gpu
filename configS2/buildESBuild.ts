import { build } from 'esbuild'
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker'

const result = await build({
  entryPoints: [
    './s2/index.ts',
    './s2/ui/s2mapUI.ts',
    './s2/workers/map.worker.ts',
    './s2/workers/source.worker.ts',
    './s2/workers/tile.worker.ts'
  ],
  bundle: true,
  minify: true,
  outdir: './buildS2',
  target: 'es2017',
  format: 'esm',
  plugins: [inlineWorkerPlugin()]
})

console.log('build complete', result)
