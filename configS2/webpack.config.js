const webpack = require('webpack')
const path = require('path')
const { version } = require('../package.json')

const { WebpackStatsViewerPlugin } = require('webpack-stats-viewer-plugin')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
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
    publicPath: `https://opens2.com/s2maps-gpu/v${version}/`,
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
        use: ['raw-loader']
      },
      {
        test: /\.ts?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true
            }
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.wasm$/,
        type: 'javascript/auto',
        use: require.resolve('../config/arraybuffer-loader')
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
    new webpack.EnvironmentPlugin(['CORS', 'API_URL']),
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
    }),
    new WebpackStatsViewerPlugin(),
    new BundleAnalyzerPlugin({ analyzerMode: 'static', generateStatsFile: true, statsFilename: 'bundle-stat.json' })
  ]
}
