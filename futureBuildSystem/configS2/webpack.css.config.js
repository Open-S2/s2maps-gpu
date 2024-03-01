"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var webpack_1 = require("webpack");
var path_1 = require("path");
var compression_webpack_plugin_1 = require("compression-webpack-plugin");
var mini_css_extract_plugin_1 = require("mini-css-extract-plugin");
var css_minimizer_webpack_plugin_1 = require("css-minimizer-webpack-plugin");
var url_1 = require("url");
var _filename = (0, url_1.fileURLToPath)(import.meta.url);
var _dirname = (0, path_1.dirname)(_filename);
// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
var conifguration = {
    mode: 'production',
    // These are the 'entry points' to our application.
    // This means they will be the 'root' imports that are included in JS bundle.
    entry: path_1.default.join(_dirname, '/../assets/styles/s2maps.css'),
    output: {
        path: path_1.default.join(_dirname, '/../buildS2'),
        filename: 'css.tmp'
    },
    context: path_1.default.join(_dirname, '/../public'),
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [
                    mini_css_extract_plugin_1.default.loader,
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
        new mini_css_extract_plugin_1.default({
            filename: 's2maps-gpu.min.css'
        }),
        new webpack_1.default.ProgressPlugin(),
        new compression_webpack_plugin_1.default({
            filename: '[path]s2maps-gpu.min.css.gz',
            algorithm: 'gzip',
            test: /\.css/,
            threshold: 0,
            minRatio: 1
        }),
        new compression_webpack_plugin_1.default({
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
            new css_minimizer_webpack_plugin_1.default()
        ]
    }
};
exports.default = conifguration;
