// setup env variables
// grab components
import fs from 'fs'
import path, { dirname } from 'path'
import webpack from 'webpack'
import { filesize } from 'filesize'
import picocolors from 'picocolors'
import configuration from './webpack.config'
import configurationDev from './webpack-dev.config'
import configurationLocal from './webpack-local.config'
import configurationCSS from './webpack.css.config'

import { fileURLToPath } from 'url'

import type { Compiler } from 'webpack'

const _filename = fileURLToPath(import.meta.url)
const _dirname = dirname(_filename)

const { blue, green, red, yellow } = picocolors

process.env.BABEL_ENV = 'production'
process.env.NODE_ENV = 'production'
process.env.CORS = '1'
process.env.NEXT_PUBLIC_API_URL = 'https://api.opens2.com/v1'
const { version } = JSON.parse(fs.readFileSync(path.join(_dirname, '../package.json'), 'utf-8')) as { version: string }
const VERSION = `v${version}`

// CLEAN UP FROM OLD BUILD
const dirPath = path.join(_dirname, '../buildS2')
if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath)
removeDir(dirPath)
const dirPathDev = path.join(_dirname, '../buildS2-dev')
if (!fs.existsSync(dirPathDev)) fs.mkdirSync(dirPathDev)
removeDir(dirPathDev)
const dirPathLocal = path.join(_dirname, '../buildS2-local')
if (!fs.existsSync(dirPathLocal)) fs.mkdirSync(dirPathLocal)
removeDir(dirPathLocal)

// SETUP COMPILER
const jsCompiler = webpack(configuration)
const jsDevCompiler = webpack(configurationDev)
const jsLocalCompiler = webpack(configurationLocal)
const cssCompiler = webpack(configurationCSS)

// COMPILE
async function build (compiler: Compiler): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    compiler.run((err, stats) => {
      const errors: Error[] = []
      if (err !== undefined && err !== null) errors.push(err)
      if (stats?.compilation.errors !== undefined) {
        for (const error of stats.compilation.errors) errors.push(error)
      }
      if (stats?.compilation.warnings !== undefined) {
        for (const error of stats.compilation.warnings) errors.push(error)
      }
      if (errors.length > 0) reject(errors)
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
  .catch((err) => { console.info('Failed to build', err) })
  .finally((): void => {
    getFileSizes()
    // copy css
    fs.copyFileSync('./buildS2/s2maps-gpu.min.css', './buildS2-local/s2maps-gpu.min.css')
    fs.copyFileSync('./buildS2/s2maps-gpu.min.css', './buildS2-dev/s2maps-gpu.min.css')
    // setup local and live version for .com
    store('../opens2.com/public/s2maps-gpu', './buildS2-local', `${VERSION}-local`)
    store('../opens2.com/public/s2maps-gpu', './buildS2', VERSION)
    // setup local and live version for .dev
    store('../s2maps.dev/public/s2maps-gpu', './buildS2-local', `${VERSION}-local`)
    store('../s2maps.dev/public/s2maps-gpu', './buildS2-dev', VERSION)
  })

function removeDir (path: string): void {
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

interface FileResolve {
  js: Record<string, Record<string, string>>
  css: Record<string, Record<string, string>>
  jsTotalmin: number
  jsTotalgz: number
  jsTotalbr: number
  jsTotalminString: string
  jsTotalgzString: string
  jsTotalbrString: string
  cssTotalmin: number
  cssTotalgz: number
  cssTotalbr: number
  cssTotalminString: string
  cssTotalgzString: string
  cssTotalbrString: string
}

function getFileSizes (): void {
  const res: FileResolve = { js: {}, css: {}, jsTotalmin: 0, jsTotalgz: 0, jsTotalbr: 0, jsTotalbrString: '', jsTotalgzString: '', jsTotalminString: '', cssTotalmin: 0, cssTotalgz: 0, cssTotalbr: 0, cssTotalminString: '', cssTotalgzString: '', cssTotalbrString: '' }
  const files = fs.readdirSync('./buildS2')

  const cssFiles = files.filter(f => f.includes('.min.css'))
  for (const file of cssFiles) {
    const name = file.includes('.gz') ? file.split('.gz')[0] : file.includes('.br') ? file.split('.br')[0] : file
    let fileType: string = file.split('.css').pop() ?? ''
    let fileTypeCorrect: 'min' | 'gz' | 'br' = 'min'
    if (fileType === '') fileType = 'min'
    else fileType = fileType.slice(1)
    fileTypeCorrect = fileType as 'min' | 'gz' | 'br'
    const { size } = fs.statSync(`./buildS2/${file}`)
    if (res.css[name] === undefined) res.css[name] = {}
    res.css[name][fileType] = filesize(size)
    res[`cssTotal${fileTypeCorrect}`] += size
  }
  res.cssTotalminString = filesize(res.cssTotalmin)
  res.cssTotalgzString = filesize(res.cssTotalgz)
  res.cssTotalbrString = filesize(res.cssTotalbr)

  const jsFiles = files.filter(f => f.includes('.min.js') && !f.includes('.txt') && !f.includes('.map'))
  for (const file of jsFiles) {
    const name = file.includes('.gz') ? file.split('.gz')[0] : file.includes('.br') ? file.split('.br')[0] : file
    let fileType = file.split('.js').pop() ?? ''
    let fileTypeCorrect: 'min' | 'gz' | 'br' = 'min'
    if (fileType === '') fileType = 'min'
    else fileType = fileType.slice(1)
    fileTypeCorrect = fileType as 'min' | 'gz' | 'br'
    const { size } = fs.statSync(`./buildS2/${file}`)
    if (res.js[name] === undefined) res.js[name] = {}
    res.js[name][fileType] = filesize(size)
    res[`jsTotal${fileTypeCorrect}`] += size
  }
  res.jsTotalminString = filesize(res.jsTotalmin)
  res.jsTotalgzString = filesize(res.jsTotalgz)
  res.jsTotalbrString = filesize(res.jsTotalbr)

  // CONSOLE CSS
  console.info(blue('CSS PACKAGES\n'))
  console.info(`${green('PACKAGE NAME')}                  ${red('MIN')}           ${blue('GZ')}           ${yellow('BR')}`)
  for (const name in res.css) {
    const { min, br, gz } = res.css[name]
    console.info(`${green(name)}${' '.repeat(30 - name.length)}${red(min)}${' '.repeat(14 - min.length)}${blue(gz)}${' '.repeat(13 - gz.length)}${yellow(br)}`)
  }
  console.info(`\n${green('TOTAL:')}${' '.repeat(30 - 6)}${red(res.cssTotalminString)}${' '.repeat(14 - res.cssTotalminString.length)}${blue(res.cssTotalgzString)}${' '.repeat(13 - res.cssTotalgzString.length)}${yellow(res.cssTotalbrString)}`)

  console.info('\n')

  // CONSOLE JS
  console.info(blue('JS MODULES\n'))
  console.info(`${green('PACKAGE NAME')}                  ${red('MIN')}           ${blue('GZ')}           ${yellow('BR')}`)
  for (const name in res.js) {
    const { min, br, gz } = res.js[name]
    console.info(`${green(name)}${' '.repeat(30 - name.length)}${red(min)}${' '.repeat(14 - min.length)}${blue(gz)}${' '.repeat(13 - gz.length)}${yellow(br)}`)
  }
  console.info(`\n${green('TOTAL:')}${' '.repeat(30 - 6)}${red(res.jsTotalminString)}${' '.repeat(14 - res.jsTotalminString.length)}${blue(res.jsTotalgzString)}${' '.repeat(13 - res.jsTotalgzString.length)}${yellow(res.jsTotalbrString)}`)

  console.info()
}

function store (
  input: string,
  outputFolder: string,
  version: string,
  canReplace = false
): void {
  // store latest version in opens2.com website if possible
  if (fs.existsSync(input)) {
    // read from files and copy over
    const dest = `${input}/${version}`
    const existsFolder = fs.existsSync(dest)
    if (canReplace || !existsFolder) {
      if (!existsFolder) fs.mkdirSync(dest)
      const files = fs.readdirSync(outputFolder)
      for (const file of files) {
        if (file.endsWith('.min.css') || file.endsWith('.min.js')) {
          fs.copyFileSync(`${outputFolder}/${file}`, `${dest}/${file}`)
        }
      }
      // store the latest version
      fs.writeFileSync(`${input}/latest.ts`, `const version = '${version}'\nexport default version\n`)
    } else {
      console.info(`${input} [${version}] already exists!`)
    }
  }
}
