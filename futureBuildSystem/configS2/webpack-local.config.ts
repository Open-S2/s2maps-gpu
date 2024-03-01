import fs from 'fs'
import webpack from 'webpack'
import path, { dirname } from 'path'

import CorsWorkerPlugin from '../config/cors-worker-plugin/index.js'
import TerserPlugin from 'terser-webpack-plugin'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'

import { fileURLToPath } from 'url'

import type { Configuration } from 'webpack'

const _filename = fileURLToPath(import.meta.url)
const _dirname = dirname(_filename)

const { version } = JSON.parse(fs.readFileSync(path.join(_dirname, '../package.json'), 'utf-8')) as { version: string }

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
    globalObject: 'this'
  },
  // context: path.join(_dirname, '/../public'),
  module: {
    rules: [
      {
        test: /\.glsl$/,
        loader: path.join(_dirname, '/../config/glsl-loader')
        // use: 'webpack-glsl-minify'
      },
      {
        test: /\.wgsl$/i,
        use: ['raw-loader']
      },
      {
        test: /\.ts?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              configFile: path.join(_dirname, '/../tsconfig.build.json')
            }
          }
        ],
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['*', '.js', '.ts'],
    modules: ['node_modules'],
    plugins: [
      new TsconfigPathsPlugin({ configFile: path.join(_dirname, '../tsconfig.json') })
    ]
  },
  optimization: {
    minimizer: [new TerserPlugin({
      extractComments: false
    })]
  },
  plugins: [
    // new webpack.EnvironmentPlugin(['CORS', 'NEXT_PUBLIC_API_URL']),
    new webpack.DefinePlugin({
      'process.env.CORS': '0',
      'process.env.NEXT_PUBLIC_API_URL': '\'http://192.168.0.113:8789/v1\''
    }),
    new webpack.BannerPlugin(`s2maps-gpu is Copyright © ${(new Date()).getFullYear()} Open S2 and subject to the S2 Maps Terms of Service (https://www.opens2.com/tos/).`),
    new webpack.ProgressPlugin(),
    new CorsWorkerPlugin()
  ]
}

export default conifguration
