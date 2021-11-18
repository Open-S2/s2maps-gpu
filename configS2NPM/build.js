// setup env variables
process.env.BABEL_ENV = 'production'
process.env.NODE_ENV = 'production'
process.env.NEXT_PUBLIC_DEV = 0
// grab components
const fs = require('fs')
const path = require('path')
const webpack = require('webpack')
const configuration = require('./webpack.config.js')
const configurationCSS = require('./webpack.css.config.js')

// CLEAN UP FROM OLD BUILD
const dirPath = path.join(__dirname, '../buildS2NPM')
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
