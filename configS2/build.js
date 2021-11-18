// setup env variables
process.env.BABEL_ENV = 'production'
process.env.NODE_ENV = 'production'
process.env.NEXT_PUBLIC_DEV = 0
// grab components
const fs = require('fs')
const path = require('path')
const webpack = require('webpack')
const filesize = require('filesize')
const { green, red, blue, yellow } = require('picocolors')
const configuration = require('./webpack.config.js')
const configurationCSS = require('./webpack.css.config.js')

// CLEAN UP FROM OLD BUILD
const dirPath = path.join(__dirname, '../buildS2')
removeDir(dirPath)

// SETUP COMPILER
const cssCompiler = webpack(configurationCSS)
const jsCompiler = webpack(configuration)

// COMPILE
function build (compiler) {
  return new Promise(resolve => {
    compiler.run((err, stats) => {
      if (err) console.error(err)
      if (stats.compilation.errors) for (const error of stats.compilation.errors) console.error(error)
      if (stats.compilation.warning) for (const error of stats.compilation.warning) console.error(error)
      resolve()
    })
  })
}

Promise.all([
  build(cssCompiler),
  build(jsCompiler)
])
  .then(res => {
    getFileSizes()
  })

function removeDir (path) {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath)

    if (files.length > 0) {
      files.forEach(filename => {
        if (fs.statSync(dirPath + '/' + filename).isDirectory()) {
          removeDir(dirPath + '/' + filename)
        } else { fs.unlinkSync(dirPath + '/' + filename) }
      })
    } else { console.log('No files found in the directory.') }
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

  const jsFiles = files.filter(f => f.includes('.min.js') && !f.includes('.txt'))
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
