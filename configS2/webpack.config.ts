import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import CompressionPlugin from 'compression-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { WebpackStatsViewerPlugin } from 'webpack-stats-viewer-plugin';
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
    path: path.join(_dirname, '../buildS2'),
    // publicPath: 'http://192.168.0.189:3000/',
    publicPath: `https://opens2.com/s2maps-gpu/v${version}/`,
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
              configFile: path.join(_dirname, '/../tsconfig.build.json'),
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
    // modules: ['node_modules'],
    plugins: [
      '...',
      new TsconfigPathsPlugin({ configFile: path.join(_dirname, '../tsconfig.json') }),
    ],
  },
  optimization: {
    usedExports: true,
    sideEffects: false,
    concatenateModules: true,
    minimizer: ['...', new TerserPlugin({ extractComments: false })],
    splitChunks: {
      cacheGroups: {
        // Create a separate chunk for shared dependencies used across main and workers
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        // You can define more specific chunking strategies if needed
      },
    },
  },
  plugins: [
    new webpack.BannerPlugin(
      `s2maps-gpu is Copyright © ${new Date().getFullYear()} Open S2 and subject to the Open S2 Terms of Service (https://www.opens2.com/legal/tos).`,
    ),
    new webpack.ProgressPlugin(),
    new CompressionPlugin({
      filename: '[path][name].js.gz',
      algorithm: 'gzip',
      test: /\.js$/,
      threshold: 0,
      minRatio: 1,
    }),
    new CompressionPlugin({
      filename: '[path][name].js.br',
      algorithm: 'brotliCompress',
      test: /\.js$/,
      compressionOptions: { level: 11 },
      threshold: 0,
      minRatio: 1,
    }),
    new WebpackStatsViewerPlugin(),
    // @ts-expect-error - types are wrong.
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      generateStatsFile: true,
      statsFilename: 'bundle-stat.json',
    }),
  ],
};

export default conifguration;
