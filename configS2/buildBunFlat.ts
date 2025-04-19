import GlslPlugin from '../config/glsl-loader/bun.ts';
import SvgPlugin from '../config/svg-loader.ts';
import WgslPlugin from '../config/wgsl-loader/bun.ts';
import { filesize } from 'filesize';
import { finished } from 'node:stream/promises';
import fs from 'node:fs';
import inlineWorkerPlugin from '../config/inline-worker-plugin/index.ts';
import path from 'node:path';
import { version } from '../package.json' with { type: 'json' };
import zlib from 'node:zlib';
import { blue, green, red, yellow } from 'picocolors';
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
} from 'node:fs';

// step 1: cleanup './buildS2-flat' directory
// step 2: build the flat bundle
// step 3: create a dummy ./buildS2-flat/workers/map.worker.js file
// step 4: create a gzip and brotli version of the flat bundle
// step 5: Copy the min files over to dest
// step 6: print file sizes

// step 1:
deleteFolder('./buildS2-flat');

// step 2:
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

getFileSizes();

export {};

/**
 * Delete a folder and all its contents
 * @param folderPath - The path to the folder
 */
function deleteFolder(folderPath: string): void {
  if (existsSync(folderPath)) {
    readdirSync(folderPath).forEach((file) => {
      const curPath: string = path.join(folderPath, file);
      if (lstatSync(curPath).isDirectory()) {
        deleteFolder(curPath); // Recursively delete sub-directories
      } else {
        unlinkSync(curPath); // Delete files
      }
    });
    rmdirSync(folderPath); // Delete the folder
  }
}

/** Build and print file sizes */
function getFileSizes(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: Record<string, any> = {
    js: {} as Record<string, Record<string, string>>,
    css: {} as Record<string, Record<string, string>>,
    jsTotalmin: 0 as number | string,
    jsTotalgz: 0 as number | string,
    jsTotalbr: 0 as number | string,
    cssTotalmin: 0 as number | string,
    cssTotalgz: 0 as number | string,
    cssTotalbr: 0 as number | string,
  };
  const files = fs.readdirSync('./buildS2-flat');

  const cssFiles = files.filter((f) => f.includes('.min.css'));
  for (const file of cssFiles) {
    // s2maps-gpu.min.css
    const name = file.includes('.gz')
      ? file.split('.gz')[0]
      : file.includes('.br')
        ? file.split('.br')[0]
        : file;
    let fileType = file.split('.css').pop() as string;
    if (fileType === '') fileType = 'min';
    else fileType = fileType.slice(1);
    const { size } = fs.statSync(`./buildS2-flat/${file}`);
    if (res.css[name] === undefined) res.css[name] = {};
    res.css[name][fileType] = filesize(size);
    res[`cssTotal${fileType}`] += size;
  }
  res.cssTotalmin = filesize(res.cssTotalmin);
  res.cssTotalgz = filesize(res.cssTotalgz);
  res.cssTotalbr = filesize(res.cssTotalbr);

  const jsFiles = files.filter(
    (f) => f.includes('.flat.js') && !f.includes('.txt') && !f.includes('.map'),
  );
  for (const file of jsFiles) {
    const name = file.includes('.gz')
      ? file.split('.gz')[0]
      : file.includes('.br')
        ? file.split('.br')[0]
        : file;
    let fileType = file.split('.js').pop() as string;
    if (fileType === '') fileType = 'min';
    else fileType = fileType.slice(1);
    const { size } = fs.statSync(`./buildS2-flat/${file}`);
    if (res.js[name] === undefined) res.js[name] = {};
    res.js[name][fileType] = filesize(size);
    res[`jsTotal${fileType}`] += size;
  }
  res.jsTotalmin = filesize(res.jsTotalmin);
  res.jsTotalgz = filesize(res.jsTotalgz);
  res.jsTotalbr = filesize(res.jsTotalbr);

  // CONSOLE CSS
  console.info(blue('CSS PACKAGES\n'));
  console.info(
    `${green('PACKAGE NAME')}                  ${red('MIN')}           ${blue('GZ')}           ${yellow('BR')}`,
  );
  for (const name in res.css) {
    const { min, br, gz } = res.css[name];
    console.info(
      `${green(name)}${' '.repeat(30 - name.length)}${red(min)}${' '.repeat(14 - min.length)}${blue(gz)}${' '.repeat(13 - gz.length)}${yellow(br)}`,
    );
  }
  console.info(
    `\n${green('TOTAL:')}${' '.repeat(30 - 6)}${red(res.cssTotalmin)}${' '.repeat(14 - res.cssTotalmin.length)}${blue(res.cssTotalgz)}${' '.repeat(13 - res.cssTotalgz.length)}${yellow(res.cssTotalbr)}`,
  );

  console.info('\n');

  // CONSOLE JS
  console.info(blue('JS MODULES\n'));
  console.info(
    `${green('PACKAGE NAME')}                  ${red('MIN')}           ${blue('GZ')}           ${yellow('BR')}`,
  );
  for (const name in res.js) {
    const { min, br, gz } = res.js[name];
    console.info(
      `${green(name)}${' '.repeat(30 - name.length)}${red(min)}${' '.repeat(14 - min.length)}${blue(gz)}${' '.repeat(13 - gz.length)}${yellow(br)}`,
    );
  }
  console.info(
    `\n${green('TOTAL:')}${' '.repeat(30 - 6)}${red(res.jsTotalmin)}${' '.repeat(14 - res.jsTotalmin.length)}${blue(res.jsTotalgz)}${' '.repeat(13 - res.jsTotalgz.length)}${yellow(res.jsTotalbr)}`,
  );

  console.info();
}
