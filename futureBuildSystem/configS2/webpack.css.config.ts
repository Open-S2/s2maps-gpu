import webpack from 'webpack'
import path, { dirname } from 'path'

import CompressionPlugin from 'compression-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin'

import { fileURLToPath } from 'url'

import type { Configuration } from 'webpack'

const _filename = fileURLToPath(import.meta.url)
const _dirname = dirname(_filename)

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
const conifguration: Configuration = {
  mode: 'production',
  // These are the 'entry points' to our application.
  // This means they will be the 'root' imports that are included in JS bundle.
  entry: path.join(_dirname, '/../assets/styles/s2maps.css'),
  output: {
    path: path.join(_dirname, '/../buildS2'),
    filename: 'css.tmp'
  },
  context: path.join(_dirname, '/../public'),
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ],
        exclude: /node_modules/
      },
      {
        test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2)$/i,
        // More information here https://webpack.js.org/guides/asset-modules/
        type: 'asset/inline'
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 's2maps-gpu.min.css'
    }),
    new webpack.ProgressPlugin(),
    new CompressionPlugin({
      filename: '[path]s2maps-gpu.min.css.gz',
      algorithm: 'gzip',
      test: /\.css/,
      threshold: 0,
      minRatio: 1
    }),
    new CompressionPlugin({
      filename: '[path]s2maps-gpu.min.css.br',
      algorithm: 'brotliCompress',
      test: /\.css/,
      compressionOptions: {
        level: 11
      },
      threshold: 0,
      minRatio: 1
    })
  ],
  optimization: {
    minimize: true,
    minimizer: [
      // For webpack@5 you can use the `...` syntax to extend existing minimizers (i.e. `terser-webpack-plugin`), uncomment the next line
      '...',
      new CssMinimizerPlugin()
    ]
  }
}

export default conifguration
