const webpack = require('webpack')

const CompressionPlugin = require('compression-webpack-plugin')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
module.exports = [
  // {
  //   mode: 'production',
  //   // These are the 'entry points' to our application.
  //   // This means they will be the 'root' imports that are included in JS bundle.
  //   entry: {
  //     's2maps-gl': __dirname + '/../public/s2/index.js'
  //   },
  //   output: {
  //     path: __dirname + '/../buildS2',
  //     filename: `[name].min.js`,
  //     // this defaults to 'window', but by setting it to 'this' then
  //     // module chunks which are built will work in web workers as well.
  //     globalObject: 'this'
  //   },
  //   module: {
  //     rules: [
  //       {
  //         test: /\.glsl$/,
  //         loader: require.resolve('../config/glsl-loader')
  //         // use: 'webpack-glsl-minify'
  //       },
  //       {
  //         test: /\.(js|mjs)$/,
  //         exclude: /@babel(?:\/|\\{1,2})runtime/,
  //         loader: require.resolve('babel-loader'),
  //         options: {
  //           babelrc: false,
  //           configFile: false,
  //           compact: false,
  //           presets: [
  //             '@babel/preset-flow',
  //             '@babel/preset-env'
  //           ],
  //           plugins: [
  //             '@babel/plugin-proposal-class-properties',
  //             // [
  //             //   'transform-runtime',
  //             //   {
  //             //     helpers: true,
  //             //     regenerator: true
  //             //   }
  //             // ]
  //           ],
  //           cacheDirectory: true,
  //
  //           // Babel sourcemaps are needed for debugging into node_modules
  //           // code.  Without the options below, debuggers like VSCode
  //           // show incorrect code and set breakpoints on the wrong lines.
  //           sourceMaps: false,
  //           inputSourceMap: false,
  //         },
  //       }
  //     ]
  //   },
  //   plugins: [
  //     new webpack.ProgressPlugin(),
  //     new CompressionPlugin({
  //       filename: `[path][name].js.gz`,
  //       algorithm: 'gzip',
  //       test: /\.js$/,
  //       threshold: 0,
  //       minRatio: 1
  //     }),
  //     new CompressionPlugin({
  //       filename: `[path][name].js.br`,
  //       algorithm: 'brotliCompress',
  //       test: /\.js$/,
  //       compressionOptions: {
  //         level: 11,
  //       },
  //       threshold: 0,
  //       minRatio: 1
  //     }),
  //     new BundleAnalyzerPlugin({ analyzerMode: 'static', generateStatsFile: true, statsFilename: 'bundle-stat-main.json' })
  //   ]
  // },
  {
    mode: 'production',
    // These are the 'entry points' to our application.
    // This means they will be the 'root' imports that are included in JS bundle.
    entry: {
      'map-worker': __dirname + '/../public/s2/workers/map.worker.js'
    },
    target: 'webworker',
    output: {
      path: __dirname + '/../buildS2',
      filename: `[name].min.js`,
      // this defaults to 'window', but by setting it to 'this' then
      // module chunks which are built will work in web workers as well.
      globalObject: 'this'
    },
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
              '@babel/plugin-proposal-class-properties',
              // [
              //   'transform-runtime',
              //   {
              //     helpers: true,
              //     regenerator: true
              //   }
              // ]
            ],
            cacheDirectory: true,

            // Babel sourcemaps are needed for debugging into node_modules
            // code.  Without the options below, debuggers like VSCode
            // show incorrect code and set breakpoints on the wrong lines.
            sourceMaps: true,
            inputSourceMap: true,
          },
        }
      ]
    },
    plugins: [
      new webpack.ProgressPlugin(),
      new CompressionPlugin({
        filename: `[path][name].js.gz`,
        algorithm: 'gzip',
        test: /\.js$/,
        threshold: 0,
        minRatio: 1
      }),
      new CompressionPlugin({
        filename: `[path][name].js.br`,
        algorithm: 'brotliCompress',
        test: /\.js$/,
        compressionOptions: {
          level: 11,
        },
        threshold: 0,
        minRatio: 1
      }),
      // new BundleAnalyzerPlugin({ analyzerMode: 'static', generateStatsFile: true, statsFilename: 'bundle-stat-map-worker.json' })
    ]
  },
  {
    mode: 'production',
    // These are the 'entry points' to our application.
    // This means they will be the 'root' imports that are included in JS bundle.
    entry: {
      'source-worker': __dirname + '/../public/s2/workers/source.worker.js'
    },
    target: 'webworker',
    output: {
      path: __dirname + '/../buildS2',
      filename: `[name].min.js`,
      // this defaults to 'window', but by setting it to 'this' then
      // module chunks which are built will work in web workers as well.
      globalObject: 'this'
    },
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
              '@babel/plugin-proposal-class-properties',
              // [
              //   'transform-runtime',
              //   {
              //     helpers: true,
              //     regenerator: true
              //   }
              // ]
            ],
            cacheDirectory: true,

            // Babel sourcemaps are needed for debugging into node_modules
            // code.  Without the options below, debuggers like VSCode
            // show incorrect code and set breakpoints on the wrong lines.
            sourceMaps: true,
            inputSourceMap: true,
          },
        }
      ]
    },
    plugins: [
      new webpack.ProgressPlugin(),
      new CompressionPlugin({
        filename: `[path][name].js.gz`,
        algorithm: 'gzip',
        test: /\.js$/,
        threshold: 0,
        minRatio: 1
      }),
      new CompressionPlugin({
        filename: `[path][name].js.br`,
        algorithm: 'brotliCompress',
        test: /\.js$/,
        compressionOptions: {
          level: 11,
        },
        threshold: 0,
        minRatio: 1
      }),
      // new BundleAnalyzerPlugin({ analyzerMode: 'static', generateStatsFile: true, statsFilename: 'bundle-stat-source-worker.json' })
    ]
  },
  {
    mode: 'production',
    // These are the 'entry points' to our application.
    // This means they will be the 'root' imports that are included in JS bundle.
    entry: {
      'tile-worker': __dirname + '/../public/s2/workers/tile.worker.js'
    },
    target: 'webworker',
    output: {
      path: __dirname + '/../buildS2',
      filename: `[name].min.js`,
      // this defaults to 'window', but by setting it to 'this' then
      // module chunks which are built will work in web workers as well.
      globalObject: 'this'
    },
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
              '@babel/plugin-proposal-class-properties',
              // [
              //   'transform-runtime',
              //   {
              //     helpers: true,
              //     regenerator: true
              //   }
              // ]
            ],
            cacheDirectory: true,

            // Babel sourcemaps are needed for debugging into node_modules
            // code.  Without the options below, debuggers like VSCode
            // show incorrect code and set breakpoints on the wrong lines.
            sourceMaps: true,
            inputSourceMap: true,
          },
        }
      ]
    },
    plugins: [
      new webpack.ProgressPlugin(),
      new CompressionPlugin({
        filename: `[path][name].js.gz`,
        algorithm: 'gzip',
        test: /\.js$/,
        threshold: 0,
        minRatio: 1
      }),
      new CompressionPlugin({
        filename: `[path][name].js.br`,
        algorithm: 'brotliCompress',
        test: /\.js$/,
        compressionOptions: {
          level: 11,
        },
        threshold: 0,
        minRatio: 1
      }),
      // new BundleAnalyzerPlugin({ analyzerMode: 'static', generateStatsFile: true, statsFilename: 'bundle-stat-tile-worker.json' })
    ]
  }
]
