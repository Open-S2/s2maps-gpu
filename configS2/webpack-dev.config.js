const webpack = require('webpack')
const path = require('path')
const { version } = require('../package.json')

const TerserPlugin = require('terser-webpack-plugin')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
module.exports = {
  mode: 'production',
  target: 'web',
  // These are the 'entry points' to our application.
  // This means they will be the 'root' imports that are included in JS bundle.
  entry: { 's2maps-gpu': path.join(__dirname, '../s2/index.ts') },
  output: {
    path: path.join(__dirname, '../buildS2-dev'),
    publicPath: `https://opens2.dev/s2maps-gpu/v${version}/`,
    workerPublicPath: `https://opens2.dev/s2maps-gpu/v${version}/`,
    filename: '[name].min.js',
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
        // use: 'webpack-glsl-minify'
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
    minimize: true,
    minimizer: [new TerserPlugin({
      extractComments: false
    })]
  },
  plugins: [
    new webpack.EnvironmentPlugin(['CORS', 'NEXT_PUBLIC_API_URL']),
    new webpack.BannerPlugin(`s2maps-gpu is Copyright © ${(new Date()).getFullYear()} OpenS2 and subject to the S2 Maps Terms of Service (https://www.opens2.com/tos/).`),
    new webpack.ProgressPlugin()
  ]
}
