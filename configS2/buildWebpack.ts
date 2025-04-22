import configuration from './webpack.config.ts';
import configurationCSS from './webpack.css.config.ts';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { getFileSizes } from './utils.ts';
import webpack from 'webpack';
import path, { dirname } from 'path';

import type { Compiler } from 'webpack';

process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';
const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);
const { version } = JSON.parse(
  fs.readFileSync(path.join(_dirname, '../package.json'), 'utf-8'),
) as { version: string };
const VERSION = `v${version}`;

// CLEAN UP FROM OLD BUILD
const dirPath = path.join(_dirname, '../buildS2');
if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);
fs.rmSync(dirPath, { recursive: true, force: true });

// SETUP COMPILER
const jsCompiler = webpack(configuration);
const cssCompiler = webpack(configurationCSS);

// COMPILE
/**
 * Compile step
 * @param compiler - Webpack compiler
 */
async function build(compiler: Compiler): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    compiler.run((err, stats) => {
      const errors: Error[] = [];
      if (err !== undefined && err !== null) errors.push(err);
      if (stats?.compilation.errors !== undefined) {
        for (const error of stats.compilation.errors) errors.push(error);
      }
      if (stats?.compilation.warnings !== undefined) {
        for (const error of stats.compilation.warnings) errors.push(error);
      }
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      if (errors.length > 0) reject(errors);
      else resolve();
    });
  });
}

Promise.all([build(cssCompiler), build(jsCompiler)])
  .catch((err) => {
    console.info('Failed to build', err);
  })
  .finally((): void => {
    getFileSizes('./buildS2');
    store('../opens2.com/public/s2maps-gpu', './buildS2', VERSION);
  });

/**
 * Store the latest version if it doesn't exist yet
 * @param input - the input folder
 * @param outputFolder - the output folder
 * @param version - the version
 * @param canReplace - if the version can be replaced or not
 */
function store(input: string, outputFolder: string, version: string, canReplace = false): void {
  // store latest version in opens2.com website if possible
  if (fs.existsSync(input)) {
    // read from files and copy over
    const dest = `${input}/${version}`;
    const existsFolder = fs.existsSync(dest);
    if (canReplace || !existsFolder) {
      if (!existsFolder) fs.mkdirSync(dest);
      const files = fs.readdirSync(outputFolder);
      for (const file of files) {
        if (file.endsWith('.min.css') || file.endsWith('.min.js')) {
          fs.copyFileSync(`${outputFolder}/${file}`, `${dest}/${file}`);
        }
      }
      // store the latest version
      fs.writeFileSync(
        `${input}/latest.ts`,
        `const version = '${version}'\nexport default version\n`,
      );
    } else {
      console.info(`${input} [${version}] already exists!`);
    }
  }
}
