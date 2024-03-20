import esbuild from 'esbuild'
import vuePlugin from 'esbuild-plugin-vue3'

const formatInput = process.env.FORMAT ?? 'esm'
const format = formatInput === 'umd'
  ? 'cjs'
  : formatInput
const formatOutName = formatInput === 'iife'
  ? 'min'
  : format

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  format,
  sourcemap: true,
  outfile: `dist/index.${formatOutName}.js`,
  plugins: [vuePlugin()],
  external: ['vue']
})

export default {}
