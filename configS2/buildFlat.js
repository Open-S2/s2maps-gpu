// setup env variables
process.env.BABEL_ENV = 'production'
process.env.NODE_ENV = 'production'
// grab components
const fs = require('fs')
const webpack = require('webpack')
const { filesize } = require('filesize')
const { green, red, blue, yellow } = require('picocolors')
// const configurationFlat = require('./webpack-flat.config.js')
const configurationCSSFlat = require('./webpack-flat.css.config.js')
const { version } = require('../package.json')
const VERSION = `v${version}`

// SETUP COMPILER
// const jsCompiler = webpack(configurationFlat)
const cssCompiler = webpack(configurationCSSFlat)

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
  build(cssCompiler)
])
  .catch((err) => { console.info('Failed to build', err) })
  .then(res => {
    getFileSizes()
    store()
  })

function getFileSizes () {
  const res = { js: {}, css: {}, jsTotalmin: 0, jsTotalgz: 0, jsTotalbr: 0, cssTotalmin: 0, cssTotalgz: 0, cssTotalbr: 0 }
  const files = fs.readdirSync('./buildS2-flat')

  const cssFiles = files.filter(f => f.includes('.min.css'))
  for (const file of cssFiles) {
    const name = file.includes('.gz') ? file.split('.gz')[0] : file.includes('.br') ? file.split('.br')[0] : file
    let fileType = file.split('.css').pop()
    if (fileType === '') fileType = 'min'
    else fileType = fileType.slice(1)
    const { size } = fs.statSync(`./buildS2-flat/${file}`)
    if (!res.css[name]) res.css[name] = {}
    res.css[name][fileType] = filesize(size)
    res[`cssTotal${fileType}`] += size
  }
  res.cssTotalmin = filesize(res.cssTotalmin)
  res.cssTotalgz = filesize(res.cssTotalgz)
  res.cssTotalbr = filesize(res.cssTotalbr)

  const jsFiles = files.filter(f => f.includes('.flat.js') && !f.includes('.txt') && !f.includes('.map'))
  for (const file of jsFiles) {
    const name = file.includes('.gz') ? file.split('.gz')[0] : file.includes('.br') ? file.split('.br')[0] : file
    let fileType = file.split('.js').pop()
    if (fileType === '') fileType = 'min'
    else fileType = fileType.slice(1)
    const { size } = fs.statSync(`./buildS2-flat/${file}`)
    if (!res.js[name]) res.js[name] = {}
    res.js[name][fileType] = filesize(size)
    res[`jsTotal${fileType}`] += size
  }
  res.jsTotalmin = filesize(res.jsTotalmin)
  res.jsTotalgz = filesize(res.jsTotalgz)
  res.jsTotalbr = filesize(res.jsTotalbr)

  // CONSOLE CSS
  console.info(blue('CSS PACKAGES\n'))
  console.info(`${green('PACKAGE NAME')}                  ${red('MIN')}           ${blue('GZ')}           ${yellow('BR')}`)
  for (const name in res.css) {
    const { min, br, gz } = res.css[name]
    console.info(`${green(name)}${' '.repeat(30 - name.length)}${red(min)}${' '.repeat(14 - min.length)}${blue(gz)}${' '.repeat(13 - gz.length)}${yellow(br)}`)
  }
  console.info(`\n${green('TOTAL:')}${' '.repeat(30 - 6)}${red(res.cssTotalmin)}${' '.repeat(14 - res.cssTotalmin.length)}${blue(res.cssTotalgz)}${' '.repeat(13 - res.cssTotalgz.length)}${yellow(res.cssTotalbr)}`)

  console.info('\n')

  // CONSOLE JS
  console.info(blue('JS MODULES\n'))
  console.info(`${green('PACKAGE NAME')}                  ${red('MIN')}           ${blue('GZ')}           ${yellow('BR')}`)
  for (const name in res.js) {
    const { min, br, gz } = res.js[name]
    console.info(`${green(name)}${' '.repeat(30 - name.length)}${red(min)}${' '.repeat(14 - min.length)}${blue(gz)}${' '.repeat(13 - gz.length)}${yellow(br)}`)
  }
  console.info(`\n${green('TOTAL:')}${' '.repeat(30 - 6)}${red(res.jsTotalmin)}${' '.repeat(14 - res.jsTotalmin.length)}${blue(res.jsTotalgz)}${' '.repeat(13 - res.jsTotalgz.length)}${yellow(res.jsTotalbr)}`)

  console.info()
}

function store () {
  const input = './buildS2-flat/s2maps-gpu.min.css'
  const dest = `../opens2.com/public/s2maps-gpu/${VERSION}-flat`
  fs.copyFileSync(input, `${dest}/s2maps-gpu.min.css`)
}
