// setup env variables
process.env.BABEL_ENV = 'production'
process.env.NODE_ENV = 'production'
process.env.NEXT_PUBLIC_DEV = 0
process.env.NEXT_PUBLIC_API_URL = 'https://api.s2maps.io/v1'
// grab components
const fs = require('fs')
const path = require('path')
const webpack = require('webpack')
const filesize = require('filesize')
const { green, red, blue, yellow } = require('picocolors')
const configuration = require('./webpack.config.js')
const configurationDev = require('./webpack-dev.config.js')
const configurationLocal = require('./webpack-local.config.js')
const configurationCSS = require('./webpack.css.config.js')
const { version } = require('../package.json')
const VERSION = `v${version}`

// CLEAN UP FROM OLD BUILD
const dirPath = path.join(__dirname, '../buildS2')
removeDir(dirPath)
const dirPathDev = path.join(__dirname, '../buildS2-dev')
removeDir(dirPathDev)
const dirPathLocal = path.join(__dirname, '../buildS2-local')
removeDir(dirPathLocal)

// SETUP COMPILER
const jsCompiler = webpack(configuration)
const jsDevCompiler = webpack(configurationDev)
const jsLocalCompiler = webpack(configurationLocal)
const cssCompiler = webpack(configurationCSS)

// COMPILE
function build (compiler) {
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      const errors = []
      if (err) errors.push(errors)
      if (stats.compilation.errors) {
        for (const error of stats.compilation.errors) errors.push(error)
      }
      if (stats.compilation.warning) {
        for (const error of stats.compilation.warning) errors.push(error)
      }
      if (errors.length) reject(errors)
      else resolve()
    })
  })
}

Promise.all([
  build(cssCompiler),
  build(jsCompiler),
  build(jsDevCompiler),
  build(jsLocalCompiler)
])
  .then(res => {
    getFileSizes()
    // copy css
    fs.copyFileSync('./buildS2/s2maps-gpu.min.css', './buildS2-local/s2maps-gpu.min.css')
    fs.copyFileSync('./buildS2/s2maps-gpu.min.css', './buildS2-dev/s2maps-gpu.min.css')
    // setup local and live version for .io
    store('../../web/s2maps.io/public/s2maps-gpu', './buildS2-local', `${VERSION}-local`)
    store('../../web/s2maps.io/public/s2maps-gpu', './buildS2', VERSION)
    // setup local and live version for .dev
    store('../../web/s2maps.dev/public/s2maps-gpu', './buildS2-local', `${VERSION}-local`)
    store('../../web/s2maps.dev/public/s2maps-gpu', './buildS2-dev', VERSION)
  })
  .catch((err) => { console.log('Failed to build', err) })

function removeDir (path) {
  if (fs.existsSync(path)) {
    const files = fs.readdirSync(path)

    if (files.length > 0) {
      files.forEach(filename => {
        if (fs.statSync(path + '/' + filename).isDirectory()) {
          removeDir(path + '/' + filename)
        } else { fs.unlinkSync(path + '/' + filename) }
      })
    }
  }
}

function getFileSizes () {
  const res = { js: {}, css: {}, jsTotalmin: 0, jsTotalgz: 0, jsTotalbr: 0, cssTotalmin: 0, cssTotalgz: 0, cssTotalbr: 0 }
  const files = fs.readdirSync('./buildS2')

  const cssFiles = files.filter(f => f.includes('.min.css'))
  for (const file of cssFiles) {
    const name = file.includes('.gz') ? file.split('.gz')[0] : file.includes('.br') ? file.split('.br')[0] : file
    let fileType = file.split('.css').pop()
    if (fileType === '') fileType = 'min'
    else fileType = fileType.slice(1)
    const { size } = fs.statSync(`./buildS2/${file}`)
    if (!res.css[name]) res.css[name] = {}
    res.css[name][fileType] = filesize(size)
    res[`cssTotal${fileType}`] += size
  }
  res.cssTotalmin = filesize(res.cssTotalmin)
  res.cssTotalgz = filesize(res.cssTotalgz)
  res.cssTotalbr = filesize(res.cssTotalbr)

  const jsFiles = files.filter(f => f.includes('.min.js') && !f.includes('.txt') && !f.includes('.map'))
  for (const file of jsFiles) {
    const name = file.includes('.gz') ? file.split('.gz')[0] : file.includes('.br') ? file.split('.br')[0] : file
    let fileType = file.split('.js').pop()
    if (fileType === '') fileType = 'min'
    else fileType = fileType.slice(1)
    const { size } = fs.statSync(`./buildS2/${file}`)
    if (!res.js[name]) res.js[name] = {}
    res.js[name][fileType] = filesize(size)
    res[`jsTotal${fileType}`] += size
  }
  res.jsTotalmin = filesize(res.jsTotalmin)
  res.jsTotalgz = filesize(res.jsTotalgz)
  res.jsTotalbr = filesize(res.jsTotalbr)

  // CONSOLE CSS
  console.log(blue('CSS PACKAGES\n'))
  console.log(`${green('PACKAGE NAME')}                  ${red('MIN')}           ${blue('GZ')}           ${yellow('BR')}`)
  for (const name in res.css) {
    const { min, br, gz } = res.css[name]
    console.log(`${green(name)}${' '.repeat(30 - name.length)}${red(min)}${' '.repeat(14 - min.length)}${blue(gz)}${' '.repeat(13 - gz.length)}${yellow(br)}`)
  }
  console.log(`\n${green('TOTAL:')}${' '.repeat(30 - 6)}${red(res.cssTotalmin)}${' '.repeat(14 - res.cssTotalmin.length)}${blue(res.cssTotalgz)}${' '.repeat(13 - res.cssTotalgz.length)}${yellow(res.cssTotalbr)}`)

  console.log('\n')

  // CONSOLE JS
  console.log(blue('JS MODULES\n'))
  console.log(`${green('PACKAGE NAME')}                  ${red('MIN')}           ${blue('GZ')}           ${yellow('BR')}`)
  for (const name in res.js) {
    const { min, br, gz } = res.js[name]
    console.log(`${green(name)}${' '.repeat(30 - name.length)}${red(min)}${' '.repeat(14 - min.length)}${blue(gz)}${' '.repeat(13 - gz.length)}${yellow(br)}`)
  }
  console.log(`\n${green('TOTAL:')}${' '.repeat(30 - 6)}${red(res.jsTotalmin)}${' '.repeat(14 - res.jsTotalmin.length)}${blue(res.jsTotalgz)}${' '.repeat(13 - res.jsTotalgz.length)}${yellow(res.jsTotalbr)}`)

  console.log()
}

function store (input, outputFolder, version) {
  // store latest version in s2maps.io website if possible
  if (fs.existsSync(input)) {
    // read from files and copy over
    const dest = `${input}/${version}`
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest)
      const files = fs.readdirSync(outputFolder)
      for (const file of files) {
        if (file.endsWith('.min.css') || file.endsWith('.min.js')) {
          fs.copyFileSync(`${outputFolder}/${file}`, `${dest}/${file}`)
        }
      }
      // store the latest version
      fs.writeFileSync(`${input}/latest.ts`, `const version = '${version}'\nexport default version\n`)
    } else {
      console.log(`${input} [${version}] already exists!`)
    }
  }
}
