const webpack = require('webpack')
const path = require('path')
const { version } = require('../package.json')

const CompressionPlugin = require('compression-webpack-plugin')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const CorsWorkerPlugin = require('../config/cors-worker-plugin')
const TerserPlugin = require('terser-webpack-plugin')

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
module.exports = {
  mode: 'production',
  target: 'web',
  // These are the 'entry points' to our application.
  // This means they will be the 'root' imports that are included in JS bundle.
  entry: { 's2maps-gpu': path.join(__dirname, '../s2/index.ts') },
  output: {
    path: path.join(__dirname, '../buildS2'),
    // publicPath: 'http://192.168.0.189:3000/',
    publicPath: `https://s2maps.io/s2maps-gpu/v${version}/`,
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
      }
    ]
  },
  resolve: {
    extensions: ['*', '.js', '.ts'],
    modules: ['node_modules']
  },
  optimization: {
    minimizer: [new TerserPlugin({
      extractComments: false,
    })],
  },
  plugins: [
    new webpack.EnvironmentPlugin(['NEXT_PUBLIC_DEV', 'NEXT_PUBLIC_API_URL']),
    new webpack.BannerPlugin(`S2Maps GPU is Copyright © ${(new Date).getFullYear()} S2Maps and subject to the S2 Maps Terms of Service (https://www.s2maps.io/tos/).`),
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
    }),
    new BundleAnalyzerPlugin({ analyzerMode: 'static', generateStatsFile: true, statsFilename: 'bundle-stat.json' })
  ]
}
