"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var webpack_1 = require("webpack");
var path_1 = require("path");
var index_js_1 = require("../config/cors-worker-plugin/index.js");
var terser_webpack_plugin_1 = require("terser-webpack-plugin");
var tsconfig_paths_webpack_plugin_1 = require("tsconfig-paths-webpack-plugin");
var url_1 = require("url");
var _filename = (0, url_1.fileURLToPath)(import.meta.url);
var _dirname = (0, path_1.dirname)(_filename);
var version = JSON.parse(fs_1.default.readFileSync(path_1.default.join(_dirname, '../package.json'), 'utf-8')).version;
// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
var conifguration = {
    mode: 'production',
    target: 'web',
    // These are the 'entry points' to our application.
    // This means they will be the 'root' imports that are included in JS bundle.
    entry: { 's2maps-gpu': path_1.default.join(_dirname, '../s2/index.ts') },
    output: {
        path: path_1.default.join(_dirname, '../buildS2-local'),
        publicPath: "http://localhost:3000/s2maps-gpu/v".concat(version, "-local/"),
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
                loader: path_1.default.join(_dirname, '/../config/glsl-loader')
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
                            configFile: path_1.default.join(_dirname, '/../tsconfig.build.json')
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
            new tsconfig_paths_webpack_plugin_1.default({ configFile: path_1.default.join(_dirname, '../tsconfig.json') })
        ]
    },
    optimization: {
        minimizer: [new terser_webpack_plugin_1.default({
                extractComments: false
            })]
    },
    plugins: [
        // new webpack.EnvironmentPlugin(['CORS', 'NEXT_PUBLIC_API_URL']),
        new webpack_1.default.DefinePlugin({
            'process.env.CORS': '0',
            'process.env.NEXT_PUBLIC_API_URL': '\'http://192.168.0.113:8789/v1\''
        }),
        new webpack_1.default.BannerPlugin("s2maps-gpu is Copyright \u00A9 ".concat((new Date()).getFullYear(), " Open S2 and subject to the S2 Maps Terms of Service (https://www.opens2.com/tos/).")),
        new webpack_1.default.ProgressPlugin(),
        new index_js_1.default()
    ]
};
exports.default = conifguration;
