import esbuild from 'esbuild'

// eslint-disable-next-line
const formatInput = process.env.FORMAT ?? 'esm'
const format = formatInput === 'umd'
  ? 'cjs'
  : formatInput
const formatOutName = formatInput === 'iife'
  ? 'min'
  : format

esbuild.build({
  entryPoints: [`src/lib/S2MapsGPU.tsx`],
  bundle: true,
  minify: true,
  format,
  sourcemap: true,
  outfile: `dist/index.${formatOutName}.js`,
  plugins: [],
  external: ['react', 'react-dom'],
})

export default {}
