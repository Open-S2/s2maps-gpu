const webpack = require('webpack-latest')

const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
module.exports = {
  mode: 'production',
  // These are the 'entry points' to our application.
  // This means they will be the 'root' imports that are included in JS bundle.
  entry: __dirname + '/../src/s2maps.css',
  output: {
    path: __dirname + '/../buildS2',
    filename: `css.tmp`
  },
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
        type: 'asset'
      },
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: `s2maps-gl.min.css`
    })
  ],
  optimization: {
    minimize: true,
    minimizer: [
      // For webpack@5 you can use the `...` syntax to extend existing minimizers (i.e. `terser-webpack-plugin`), uncomment the next line
      `...`,
      new CssMinimizerPlugin()
    ]
  },
}
