const webpack = require('webpack')
const path = require('path')

const CompressionPlugin = require('compression-webpack-plugin')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const CorsWorkerPlugin = require('../config/cors-worker-plugin')

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
module.exports = {
  mode: 'production',
  target: 'web',
  entry: path.join(__dirname, '../s2/flat.ts'),
  output: {
    path: path.join(__dirname, '../buildS2-flat'),
    filename: '[name].min.js',
    // filename: 's2maps-gpu.min.js',
    // this defaults to 'window', but by setting it to 'this' then
    // module chunks which are built will work in web workers as well.
    globalObject: 'this'
  },
  context: path.join(__dirname, '/../public'),
  module: {
    rules: [
      {
        test: /\.glsl$/,
        loader: require.resolve('../config/glsl-loader')
      },
      {
        test: /\.wgsl$/i,
        loader: require.resolve('../config/wgsl-loader')
      },
      {
        test: /\.ts?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              configFile: path.join(__dirname, '/../tsconfig.build.json')
            }
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.worker\.ts$/,
        use: {
          loader: 'worker-loader',
          options: {
            inline: 'fallback'
          }
        },
        type: 'asset/inline'
      }
    ]
  },

  resolve: {
    extensions: ['*', '.js', '.ts'],
    modules: ['node_modules'],
    plugins: [
      new TsconfigPathsPlugin({ configFile: path.join(__dirname, '../tsconfig.json') })
    ]
  },
  optimization: {
    concatenateModules: true,
    runtimeChunk: {
      name: 'runtime'
    },
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        default: false,
        vendors: false
      }
    },
    minimize: true,
    minimizer: [new TerserPlugin({
      extractComments: false
    })]
  },
  plugins: [
    // avoid dynamic imports creating new chunks
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1 // Limit to a single chunk/bundle
    }),
    new webpack.EnvironmentPlugin(['CORS', 'NEXT_PUBLIC_API_URL']),
    new webpack.BannerPlugin(`s2maps-gpu is Copyright © ${(new Date()).getFullYear()} Open S2 and subject to the Open S2 Terms of Service (https://www.opens2.com/tos/).`),
    new webpack.ProgressPlugin(),
    new CorsWorkerPlugin(),
    new CompressionPlugin({
      filename: '[path][name].js.gz',
      algorithm: 'gzip',
      test: /\.js$/,
      threshold: 0,
      minRatio: 1
    }),
    new CompressionPlugin({
      filename: '[path][name].js.br',
      algorithm: 'brotliCompress',
      test: /\.js$/,
      compressionOptions: { level: 11 },
      threshold: 0,
      minRatio: 1
    })
  ]
}
