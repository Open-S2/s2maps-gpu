import TerserPlugin from 'terser-webpack-plugin';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { fileURLToPath } from 'url';
import fs from 'fs';
import webpack from 'webpack';
import path, { dirname } from 'path';

import type { Configuration } from 'webpack';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);
// Define the project root directory (assuming tsconfig.json is there)
const projectRoot = path.resolve(_dirname, '../s2');

const { version } = JSON.parse(
  fs.readFileSync(path.join(_dirname, '../package.json'), 'utf-8'),
) as { version: string };

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
const conifguration: Configuration = {
  mode: 'production',
  target: 'web',
  // These are the 'entry points' to our application.
  // This means they will be the 'root' imports that are included in JS bundle.
  entry: { 's2maps-gpu': path.join(_dirname, '../s2/index.ts') },
  output: {
    path: path.join(_dirname, '../buildS2-local'),
    publicPath: `http://localhost:3000/s2maps-gpu/v${version}-local/`,
    filename: '[name].min.js',
    // this defaults to 'window', but by setting it to 'this' then
    // module chunks which are built will work in web workers as well.
    globalObject: 'this',
  },
  // context: path.join(_dirname, '/../public'),
  module: {
    rules: [
      {
        test: /\.glsl$/,
        loader: path.join(_dirname, '/../config/glsl-loader/index.ts'),
        // use: 'webpack-glsl-minify'
      },
      {
        test: /\.wgsl$/i,
        use: ['raw-loader'],
      },
      {
        test: /\.ts?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              configFile: path.join(_dirname, '/../tsconfig.json'),
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['*', '.js', '.ts'],
    extensionAlias: { '.js': ['.js', '.ts'], '.ts': ['.js', '.ts'] },
    alias: {
      // Map aliases from tsconfig.json to absolute paths
      // Assuming tsconfig.json's baseUrl is the project root ('../' from webpack config dir)
      s2: [path.resolve(projectRoot, 's2'), path.resolve(projectRoot, './')],
      'gis-tools': path.resolve(projectRoot, 'gis-tools'),
      gl: path.resolve(projectRoot, 'gl'),
      gpu: path.resolve(projectRoot, 'gpu'),
      plugins: path.resolve(projectRoot, 'plugins'),
      source: path.resolve(projectRoot, 'source'),
      style: path.resolve(projectRoot, 'style'), // This is the key one for your error
      ui: path.resolve(projectRoot, 'ui'),
      util: path.resolve(projectRoot, 'util'),
      workers: path.resolve(projectRoot, 'workers'),
      // You might not need the "*" alias here, Webpack handles node_modules
    },
    modules: ['node_modules'],
    plugins: [
      new TsconfigPathsPlugin({ configFile: path.join(_dirname, '../tsconfig.build.json') }),
    ],
  },
  optimization: {
    usedExports: true,
    minimizer: ['...', new TerserPlugin({ extractComments: false })],
    // splitChunks: {
    //   chunks: 'all', // Keep 'all' usually, but refine with cacheGroups
    //   // cacheGroups: {
    //   //   // Example: Extract shared application code (adjust test/name as needed)
    //   //   shared: {
    //   //     name: 'shared',
    //   //     chunks: 'all',
    //   //     minChunks: 2, // Module must be shared by at least 2 chunks
    //   //     priority: -20,
    //   //     reuseExistingChunk: true, // If it's already in another chunk, reuse it
    //   //   },
    //   // },
    // },
  },
  plugins: [
    new webpack.BannerPlugin(
      `s2maps-gpu is Copyright © ${new Date().getFullYear()} Open S2 and subject to the Open S2 Terms of Service (https://www.opens2.com/legal/tos).`,
    ),
    new webpack.ProgressPlugin(),
  ],
};

export default conifguration;
