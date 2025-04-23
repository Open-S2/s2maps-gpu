import GlslPlugin from '../config/glsl-loader/bun.ts';
import SvgPlugin from '../config/svg-loader.ts';
import WgslPlugin from '../config/wgsl-loader/bun.ts';
import { finished } from 'node:stream/promises';
import { getFileSizes } from './utils.ts';
import inlineWorkerPlugin from '../config/inline-worker-plugin/index.ts';
import { version } from '../package.json' with { type: 'json' };
import zlib from 'node:zlib';
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
} from 'fs';

// step 1: cleanup './buildS2-flat' directory
// step 2: build the flat bundle
// step 3: create a dummy ./buildS2-flat/workers/map.worker.js file
// step 4: create a gzip and brotli version of the flat bundle
// step 5: Copy the min files over to dest
// step 6: print file sizes

// step 1: cleanup './buildS2-flat' directory
rmSync('./buildS2-flat', { recursive: true, force: true });

// step 2: build the flat bundle
const resultJS = await Bun.build({
  entrypoints: ['./s2/flat.ts'],
  outdir: './buildS2-flat',
  naming: 's2maps-gpu.flat.js',
  minify: true,
  sourcemap: 'external',
  splitting: false,
  target: 'browser',
  plugins: [
    GlslPlugin,
    WgslPlugin,
    // @ts-expect-error - this actually works.
    inlineWorkerPlugin({
      target: 'esnext',
      // plugins: [GlslPlugin, WgslPlugin]
    }),
  ],
  // publicPath: `https://opens2.com/s2maps-gpu/v${version}/`
  // naming: '[name].[ext]'
});
const resultCSS = await Bun.build({
  entrypoints: ['./s2/s2maps.css'],
  outdir: './buildS2-flat',
  naming: 's2maps-gpu.min.css',
  minify: true,
  plugins: [SvgPlugin],
});

// step 3:
mkdirSync('./buildS2-flat/workers');
await Bun.write('./buildS2-flat/workers/map.worker.js', '/* dummy worker */');

// step 4:
const inputFileJS = './buildS2-flat/s2maps-gpu.flat.js';
const gzipOutputFileJS = './buildS2-flat/s2maps-gpu.flat.js.gz';
const brotliOutputFileJS = './buildS2-flat/s2maps-gpu.flat.js.br';
const inputFileCSS = './buildS2-flat/s2maps-gpu.min.css';
const gzipOutputFileCSS = './buildS2-flat/s2maps-gpu.min.css.gz';
const brotliOutputFileCSS = './buildS2-flat/s2maps-gpu.min.css.br';

/**
 * Compress a file
 * @param input - the location of the input file
 * @param output - the location to store the compressed file
 * @param compressor - the compression algorithm
 */
async function compressFile(
  input: string,
  output: string,
  compressor: zlib.Gzip | zlib.BrotliCompress,
): Promise<void> {
  const inputStream = createReadStream(input);
  const outputStream = createWriteStream(output);
  inputStream.pipe(compressor).pipe(outputStream);
  await finished(outputStream); // Wait for the stream to finish
}
// Gzip compression
await compressFile(inputFileJS, gzipOutputFileJS, zlib.createGzip());
await compressFile(inputFileCSS, gzipOutputFileCSS, zlib.createGzip());
// Brotli compression
await compressFile(inputFileJS, brotliOutputFileJS, zlib.createBrotliCompress());
await compressFile(inputFileCSS, brotliOutputFileCSS, zlib.createBrotliCompress());

// store
const dest = `../opens2.com/public/s2maps-gpu/v${version}-flat`;
const existsFolder = existsSync(dest);
if (!existsFolder) {
  mkdirSync(dest);
  copyFileSync(inputFileJS, `${dest}/s2maps-gpu.flat.js`);
  copyFileSync(inputFileCSS, `${dest}/s2maps-gpu.min.css`);
} else {
  console.info('[flat] already exists!', dest);
}

// @ts-expect-error - I don't care
if (!resultJS.success) throw Error('ERROR', resultJS);
// @ts-expect-error - I don't care
if (!resultCSS.success) throw Error('ERROR', resultCSS);

console.info('Build complete', version, '\n\n');

getFileSizes('./buildS2-flat');

export {};
