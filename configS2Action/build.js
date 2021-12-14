// pull from env action
require('dotenv').config({ path: '../.env.action' })
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
const { version } = require('../package.json')
const { S3 } = require('aws-sdk')
// const { getInput, info, error, setFailed } = require('@actions/core')

const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET, ROOT_LOCATION } = process.env

// setup version
// const branch = BRANCH
const VERSION = `v${version}`

// setup S3
const s3 = new S3({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, region: 'us-east-1', signatureVersion: 'v4' })
const Bucket = BUCKET

// CLEAN UP FROM OLD BUILD
const dirPath = path.join(__dirname, '../buildS2Action')
removeDir(dirPath)

// SETUP COMPILER
const cssCompiler = webpack(configurationCSS)
const jsCompiler = webpack(configuration)

// COMPILE
function build (compiler) {
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) reject(err)
      if (stats.compilation.errors) for (const error of stats.compilation.errors) reject(error)
      if (stats.compilation.warning) for (const error of stats.compilation.warning) reject(error)
      resolve(true)
    })
  })
}

checkIfExists()
  .then(exists => {
    if (!exists) {
      return Promise.all([
        build(cssCompiler),
        build(jsCompiler)
      ])
    } else {
      console.log('No need to upload')
      return null
    }
  })
  .then(res => {
    // upload
    if (res) uploadData()
  })
  .then(res => {
    console.log('COMPLETE')
  })
  .catch(err => { console.error(err) })

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

function uploadData () {
  // buildS2Action
  const files = fs.readdirSync(dirPath).filter(f => !f.includes('.txt') && !f.includes('.tmp'))
  if (files.length) console.log('uploading...')
  // prep promises
  const promises = []
  // upload
  for (const file of files) {
    // pull in file data
    const data = fs.readFileSync(`${dirPath}/${file}`)
    // check if css or js
    const contentType = file.includes('.css') ? 'text/css' : 'application/javascript'
    // upload
    promises.push(storeFile(data, file, contentType))
  }

  return Promise.all(promises)
}

function checkIfExists () {
  return new Promise(resolve => {
    s3.listObjects({ Bucket, Prefix: `${ROOT_LOCATION}/${VERSION}` }, (err, data) => {
      if (err) return resolve(true)
      if (data.Contents.length) return resolve(true)
      resolve(false)
    })
  })
}

function storeFile (Body, name, ContentType) {
  return new Promise(resolve => {
    const obj = {
      Bucket,
      Body,
      Key: `${ROOT_LOCATION}/${VERSION}/${name}`,
      ContentType,
      CacheControl: 'max-age=31536000,s-maxage=31536000'
    }
    s3.putObject(obj, err => {
      if (err) resolve(false)
      else resolve(true)
    })
  })
}
