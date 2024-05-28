import { version } from 'package.json'
import path from 'node:path'
import zlib from 'node:zlib'
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmdirSync,
  unlinkSync
} from 'node:fs'
import GlslPlugin from 'config/glsl-loader/bun'
import WgslPlugin from 'config/wgsl-loader/bun'
import inlineWorkerPlugin from 'config/inline-worker-plugin'

// step 1: cleanup './buildS2-flat' directory
// step 2: build the flat bundle
// step 3: create a dummy ./buildS2-flat/workers/map.worker.js file
// step 4: create a gzip and brotli version of the flat bundle

// step 1:
deleteFolder('./buildS2-flat')

// step 2:
const result = await Bun.build({
  entrypoints: ['./s2/flat.ts'],
  outdir: './buildS2-flat',
  naming: 's2maps-gpu.flat.js',
  minify: true,
  sourcemap: 'external',
  splitting: false,
  target: 'browser',
  plugins: [GlslPlugin, WgslPlugin, inlineWorkerPlugin({
    target: 'es2020'
    // plugins: [GlslPlugin, WgslPlugin]
  })]
  // publicPath: `https://opens2.com/s2maps-gpu/v${version}/`
  // naming: '[name].[ext]'
})

// step 3:
mkdirSync('./buildS2-flat/workers')
await Bun.write('./buildS2-flat/workers/map.worker.js', '/* dummy worker */')

// step 4:
const inputFile = './buildS2-flat/s2maps-gpu.flat.js'
const gzipOutputFile = './buildS2-flat/s2maps-gpu.flat.js.gz'
const brotliOutputFile = './buildS2-flat/s2maps-gpu.flat.js.br'

// Gzip compression
const gzip = zlib.createGzip()
const inputStream = createReadStream(inputFile)
const outputStream = createWriteStream(gzipOutputFile)
inputStream.pipe(gzip).pipe(outputStream)

const brotli = zlib.createBrotliCompress()
const inputStream2 = createReadStream(inputFile)
const outputStream2 = createWriteStream(brotliOutputFile)
inputStream2.pipe(brotli).pipe(outputStream2)

// store
const dest = `../opens2.com/public/s2maps-gpu/v${version}-flat`
const existsFolder = existsSync(dest)
if (!existsFolder) {
  mkdirSync(dest)
  copyFileSync(inputFile, `${dest}/s2maps-gpu.flat.js`)
} else {
  console.info('[flat] already exists!', dest)
}

console.info('Build complete', result, version)

export {}

function deleteFolder (folderPath: string): void {
  if (existsSync(folderPath)) {
    readdirSync(folderPath).forEach((file) => {
      const curPath: string = path.join(folderPath, file)
      if (lstatSync(curPath).isDirectory()) {
        deleteFolder(curPath) // Recursively delete sub-directories
      } else {
        unlinkSync(curPath) // Delete files
      }
    })
    rmdirSync(folderPath) // Delete the folder
  }
}
