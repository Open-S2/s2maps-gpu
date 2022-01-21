const webpack = require('webpack')
const path = require('path')
const { version } = require('../package.json')

const CompressionPlugin = require('compression-webpack-plugin')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const CorsWorkerPlugin = require('../config/cors-worker-plugin')

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
module.exports = {
  mode: 'production',
  target: 'web',
  // These are the 'entry points' to our application.
  // This means they will be the 'root' imports that are included in JS bundle.
  entry: { 's2maps-gl': path.join(__dirname, '../public/s2/index.js') },
  output: {
    path: path.join(__dirname, '../buildS2'),
    // publicPath: 'http://192.168.0.189:3000/',
    publicPath: `https://s2maps.io/s2maps-gl/v${version}/`,
    filename: '[name].min.js',
    // this defaults to 'window', but by setting it to 'this' then
    // module chunks which are built will work in web workers as well.
    globalObject: 'this'
  },
  context: path.join(__dirname, '/../public'),
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.glsl$/,
        loader: require.resolve('../config/glsl-loader')
        // use: 'webpack-glsl-minify'
      },
      {
        test: /\.(js|mjs)$/,
        exclude: /@babel(?:\/|\\{1,2})runtime/,
        loader: require.resolve('babel-loader'),
        options: {
          babelrc: false,
          configFile: false,
          compact: false,
          presets: [
            '@babel/preset-flow',
            '@babel/preset-env'
          ],
          plugins: [
            [
              '@babel/plugin-transform-runtime',
              {
                helpers: false,
                regenerator: true
              }
            ]
          ],
          cacheDirectory: true,
          // See #6846 for context on why cacheCompression is disabled (create-react-app)
          cacheCompression: false,

          // Babel sourcemaps are needed for debugging into node_modules
          // code.  Without the options below, debuggers like VSCode
          // show incorrect code and set breakpoints on the wrong lines.
          sourceMaps: false,
          inputSourceMap: false
        }
      }
    ]
  },
  resolve: {
    extensions: ['*', '.js']
  },
  plugins: [
    new webpack.EnvironmentPlugin(['NEXT_PUBLIC_DEV']),
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
