/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

/**
 * @module vite-plugin-wgsl
 * @author Ustym Ukhman <ustym.ukhman@gmail.com>
 * @source https://github.com/UstymUkhman/vite-plugin-wgsl
 * @description Import, inline (and compress) WGSL shader files
 * @version 1.2.1
 * @license MIT
 */

import { createFilter } from '@rollup/pluginutils';
import parse from './parse';
import { transformWithEsbuild } from 'vite';

import type { Plugin, ResolvedConfig } from 'vite';

// /**
//  * @constant
//  * @default
//  * @readonly
//  * @type {string}
//  */
// const DEFAULT_EXTENSION = 'wgsl';

/**
 * @constant
 * @default
 * @readonly
 */
const DEFAULT_SHADERS = Object.freeze(['**/*.wgsl']);

/**
 * @function
 * @name wgsl
 * @param options - plugin options
 * @param options.include - array of globs to include
 * @param options.exclude - array of globs to exclude
 * @description Plugin entry point to import,
 * inline, (and compress) WGSL shader files
 * @see {@link https://vitejs.dev/guide/api-plugin.html}
 * @returns Vite plugin that converts shader code
 */
export default function ({
  include = DEFAULT_SHADERS,
  exclude = undefined,
  // warnDuplicatedImports = true,
  // defaultExtension = DEFAULT_EXTENSION,
  // compress = false,
  // watch = true,
  // root = '/',
} = {}): Plugin {
  let config;
  const filter = createFilter(include, exclude);
  const prod = process.env.NODE_ENV === 'production';

  return {
    enforce: 'pre',
    name: 'vite-plugin-wgsl',

    /**
     * Set the resolve Vite config into the plugin
     * @param resolvedConfig - resolved Vite config
     */
    configResolved(resolvedConfig: ResolvedConfig): void {
      config = resolvedConfig;
    },

    /**
     * Transform GLSL shader files
     * @param source - source location
     * @param shader - shader code
     * @returns transformed shader if matched
     */
    async transform(source, shader) {
      if (!filter(shader)) return;

      return await transformWithEsbuild(parse(shader, source), shader, {
        sourcemap: (config.build.sourcemap as boolean) && 'external',
        loader: 'ts',
        format: 'esm',
        minifyWhitespace: prod,
      });
    },
  };
}
