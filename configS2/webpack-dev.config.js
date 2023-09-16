const webpack = require('webpack')
const path = require('path')
const { version } = require('../package.json')

const CorsWorkerPlugin = require('../config/cors-worker-plugin')
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
    publicPath: `https://s2maps.dev/s2maps-gpu/v${version}/`,
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
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.wasm$/,
        type: 'javascript/auto',
        use: ['arraybuffer-loader']
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
    minimizer: [new TerserPlugin({
      extractComments: false
    })]
  },
  plugins: [
    new webpack.EnvironmentPlugin(['CORS', 'NEXT_PUBLIC_API_URL']),
    new webpack.BannerPlugin(`S2Maps GPU is Copyright © ${(new Date()).getFullYear()} S2Maps and subject to the S2 Maps Terms of Service (https://www.s2maps.io/tos/).`),
    new webpack.ProgressPlugin(),
    new CorsWorkerPlugin()
  ]
}
