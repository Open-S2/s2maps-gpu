import GlslPlugin from './config/glsl-loader/bun';
import WgslPlugin from './config/wgsl-loader/bun';
import path from 'node:path';
import { existsSync, lstatSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';

const { version } = await Bun.file('./package.json').json();

deleteFolder('./buildS2-local');

await Bun.build({
  entrypoints: [
    './s2/index.ts',
    // './s2/ui/s2mapUI.ts',
    // './s2/workers/map.worker.ts',
    // './s2/workers/source.worker.ts',
    // './s2/workers/tile.worker.ts',
  ],
  outdir: './buildS2-local',
  minify: false,
  sourcemap: 'external',
  splitting: true,
  target: 'browser',
  publicPath: `https://opens2.com/s2maps-gpu/v${version}/`,
  naming: '[name]-[hash].[ext]',
  plugins: [GlslPlugin, WgslPlugin],
});

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

export {};
