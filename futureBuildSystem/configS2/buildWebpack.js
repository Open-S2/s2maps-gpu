"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// setup env variables
// grab components
var fs_1 = require("fs");
var path_1 = require("path");
var webpack_1 = require("webpack");
var filesize_1 = require("filesize");
var picocolors_1 = require("picocolors");
var webpack_config_1 = require("./webpack.config");
var webpack_dev_config_1 = require("./webpack-dev.config");
var webpack_local_config_1 = require("./webpack-local.config");
var webpack_css_config_1 = require("./webpack.css.config");
var url_1 = require("url");
var _filename = (0, url_1.fileURLToPath)(import.meta.url);
var _dirname = (0, path_1.dirname)(_filename);
var blue = picocolors_1.default.blue, green = picocolors_1.default.green, red = picocolors_1.default.red, yellow = picocolors_1.default.yellow;
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';
process.env.CORS = '1';
process.env.NEXT_PUBLIC_API_URL = 'https://api.opens2.com/v1';
var version = JSON.parse(fs_1.default.readFileSync(path_1.default.join(_dirname, '../package.json'), 'utf-8')).version;
var VERSION = "v".concat(version);
// CLEAN UP FROM OLD BUILD
var dirPath = path_1.default.join(_dirname, '../buildS2');
if (!fs_1.default.existsSync(dirPath))
    fs_1.default.mkdirSync(dirPath);
removeDir(dirPath);
var dirPathDev = path_1.default.join(_dirname, '../buildS2-dev');
if (!fs_1.default.existsSync(dirPathDev))
    fs_1.default.mkdirSync(dirPathDev);
removeDir(dirPathDev);
var dirPathLocal = path_1.default.join(_dirname, '../buildS2-local');
if (!fs_1.default.existsSync(dirPathLocal))
    fs_1.default.mkdirSync(dirPathLocal);
removeDir(dirPathLocal);
// SETUP COMPILER
var jsCompiler = (0, webpack_1.default)(webpack_config_1.default);
var jsDevCompiler = (0, webpack_1.default)(webpack_dev_config_1.default);
var jsLocalCompiler = (0, webpack_1.default)(webpack_local_config_1.default);
var cssCompiler = (0, webpack_1.default)(webpack_css_config_1.default);
// COMPILE
function build(compiler) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                        compiler.run(function (err, stats) {
                            var errors = [];
                            if (err !== undefined && err !== null)
                                errors.push(err);
                            if ((stats === null || stats === void 0 ? void 0 : stats.compilation.errors) !== undefined) {
                                for (var _i = 0, _a = stats.compilation.errors; _i < _a.length; _i++) {
                                    var error = _a[_i];
                                    errors.push(error);
                                }
                            }
                            if ((stats === null || stats === void 0 ? void 0 : stats.compilation.warnings) !== undefined) {
                                for (var _b = 0, _c = stats.compilation.warnings; _b < _c.length; _b++) {
                                    var error = _c[_b];
                                    errors.push(error);
                                }
                            }
                            if (errors.length > 0)
                                reject(errors);
                            else
                                resolve();
                        });
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
Promise.all([
    build(cssCompiler),
    build(jsCompiler),
    build(jsDevCompiler),
    build(jsLocalCompiler)
])
    .catch(function (err) { console.info('Failed to build', err); })
    .finally(function () {
    getFileSizes();
    // copy css
    fs_1.default.copyFileSync('./buildS2/s2maps-gpu.min.css', './buildS2-local/s2maps-gpu.min.css');
    fs_1.default.copyFileSync('./buildS2/s2maps-gpu.min.css', './buildS2-dev/s2maps-gpu.min.css');
    // setup local and live version for .com
    store('../opens2.com/public/s2maps-gpu', './buildS2-local', "".concat(VERSION, "-local"));
    store('../opens2.com/public/s2maps-gpu', './buildS2', VERSION);
    // setup local and live version for .dev
    store('../s2maps.dev/public/s2maps-gpu', './buildS2-local', "".concat(VERSION, "-local"));
    store('../s2maps.dev/public/s2maps-gpu', './buildS2-dev', VERSION);
});
function removeDir(path) {
    if (fs_1.default.existsSync(path)) {
        var files = fs_1.default.readdirSync(path);
        if (files.length > 0) {
            files.forEach(function (filename) {
                if (fs_1.default.statSync(path + '/' + filename).isDirectory()) {
                    removeDir(path + '/' + filename);
                }
                else {
                    fs_1.default.unlinkSync(path + '/' + filename);
                }
            });
        }
    }
}
function getFileSizes() {
    var _a, _b;
    var res = { js: {}, css: {}, jsTotalmin: 0, jsTotalgz: 0, jsTotalbr: 0, jsTotalbrString: '', jsTotalgzString: '', jsTotalminString: '', cssTotalmin: 0, cssTotalgz: 0, cssTotalbr: 0, cssTotalminString: '', cssTotalgzString: '', cssTotalbrString: '' };
    var files = fs_1.default.readdirSync('./buildS2');
    var cssFiles = files.filter(function (f) { return f.includes('.min.css'); });
    for (var _i = 0, cssFiles_1 = cssFiles; _i < cssFiles_1.length; _i++) {
        var file = cssFiles_1[_i];
        var name_1 = file.includes('.gz') ? file.split('.gz')[0] : file.includes('.br') ? file.split('.br')[0] : file;
        var fileType = (_a = file.split('.css').pop()) !== null && _a !== void 0 ? _a : '';
        var fileTypeCorrect = 'min';
        if (fileType === '')
            fileType = 'min';
        else
            fileType = fileType.slice(1);
        fileTypeCorrect = fileType;
        var size = fs_1.default.statSync("./buildS2/".concat(file)).size;
        if (res.css[name_1] === undefined)
            res.css[name_1] = {};
        res.css[name_1][fileType] = (0, filesize_1.filesize)(size);
        res["cssTotal".concat(fileTypeCorrect)] += size;
    }
    res.cssTotalminString = (0, filesize_1.filesize)(res.cssTotalmin);
    res.cssTotalgzString = (0, filesize_1.filesize)(res.cssTotalgz);
    res.cssTotalbrString = (0, filesize_1.filesize)(res.cssTotalbr);
    var jsFiles = files.filter(function (f) { return f.includes('.min.js') && !f.includes('.txt') && !f.includes('.map'); });
    for (var _c = 0, jsFiles_1 = jsFiles; _c < jsFiles_1.length; _c++) {
        var file = jsFiles_1[_c];
        var name_2 = file.includes('.gz') ? file.split('.gz')[0] : file.includes('.br') ? file.split('.br')[0] : file;
        var fileType = (_b = file.split('.js').pop()) !== null && _b !== void 0 ? _b : '';
        var fileTypeCorrect = 'min';
        if (fileType === '')
            fileType = 'min';
        else
            fileType = fileType.slice(1);
        fileTypeCorrect = fileType;
        var size = fs_1.default.statSync("./buildS2/".concat(file)).size;
        if (res.js[name_2] === undefined)
            res.js[name_2] = {};
        res.js[name_2][fileType] = (0, filesize_1.filesize)(size);
        res["jsTotal".concat(fileTypeCorrect)] += size;
    }
    res.jsTotalminString = (0, filesize_1.filesize)(res.jsTotalmin);
    res.jsTotalgzString = (0, filesize_1.filesize)(res.jsTotalgz);
    res.jsTotalbrString = (0, filesize_1.filesize)(res.jsTotalbr);
    // CONSOLE CSS
    console.info(blue('CSS PACKAGES\n'));
    console.info("".concat(green('PACKAGE NAME'), "                  ").concat(red('MIN'), "           ").concat(blue('GZ'), "           ").concat(yellow('BR')));
    for (var name_3 in res.css) {
        var _d = res.css[name_3], min = _d.min, br = _d.br, gz = _d.gz;
        console.info("".concat(green(name_3)).concat(' '.repeat(30 - name_3.length)).concat(red(min)).concat(' '.repeat(14 - min.length)).concat(blue(gz)).concat(' '.repeat(13 - gz.length)).concat(yellow(br)));
    }
    console.info("\n".concat(green('TOTAL:')).concat(' '.repeat(30 - 6)).concat(red(res.cssTotalminString)).concat(' '.repeat(14 - res.cssTotalminString.length)).concat(blue(res.cssTotalgzString)).concat(' '.repeat(13 - res.cssTotalgzString.length)).concat(yellow(res.cssTotalbrString)));
    console.info('\n');
    // CONSOLE JS
    console.info(blue('JS MODULES\n'));
    console.info("".concat(green('PACKAGE NAME'), "                  ").concat(red('MIN'), "           ").concat(blue('GZ'), "           ").concat(yellow('BR')));
    for (var name_4 in res.js) {
        var _e = res.js[name_4], min = _e.min, br = _e.br, gz = _e.gz;
        console.info("".concat(green(name_4)).concat(' '.repeat(30 - name_4.length)).concat(red(min)).concat(' '.repeat(14 - min.length)).concat(blue(gz)).concat(' '.repeat(13 - gz.length)).concat(yellow(br)));
    }
    console.info("\n".concat(green('TOTAL:')).concat(' '.repeat(30 - 6)).concat(red(res.jsTotalminString)).concat(' '.repeat(14 - res.jsTotalminString.length)).concat(blue(res.jsTotalgzString)).concat(' '.repeat(13 - res.jsTotalgzString.length)).concat(yellow(res.jsTotalbrString)));
    console.info();
}
function store(input, outputFolder, version, canReplace) {
    if (canReplace === void 0) { canReplace = false; }
    // store latest version in opens2.com website if possible
    if (fs_1.default.existsSync(input)) {
        // read from files and copy over
        var dest = "".concat(input, "/").concat(version);
        var existsFolder = fs_1.default.existsSync(dest);
        if (canReplace || !existsFolder) {
            if (!existsFolder)
                fs_1.default.mkdirSync(dest);
            var files = fs_1.default.readdirSync(outputFolder);
            for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
                var file = files_1[_i];
                if (file.endsWith('.min.css') || file.endsWith('.min.js')) {
                    fs_1.default.copyFileSync("".concat(outputFolder, "/").concat(file), "".concat(dest, "/").concat(file));
                }
            }
            // store the latest version
            fs_1.default.writeFileSync("".concat(input, "/latest.ts"), "const version = '".concat(version, "'\nexport default version\n"));
        }
        else {
            console.info("".concat(input, " [").concat(version, "] already exists!"));
        }
    }
}
