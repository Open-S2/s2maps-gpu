import { version } from 'package.json'
import GlslPlugin from 'config/glsl-loader/bun'
import WgslPlugin from 'config/wgsl-loader/bun'
// TODO: remove this dependency for a bun plugin
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker'
// import InlineWorkerPlugin from 'config/inline-worker-plugin'

const result = await Bun.build({
  entrypoints: [
    './s2/flat.ts'
  ],
  outdir: './buildS2-flat',
  naming: 's2maps-gpu.flat.js',
  minify: true,
  sourcemap: 'external',
  splitting: false,
  target: 'browser',
  plugins: [GlslPlugin, WgslPlugin, inlineWorkerPlugin({
    target: 'es2020'
    // plugins: [GlslPlugin, WgslPlugin]
  })],
  publicPath: `https://opens2.com/s2maps-gpu/v${version}/`
  // naming: '[name].[ext]'
})

console.info('Build complete', result, version)

export {}
