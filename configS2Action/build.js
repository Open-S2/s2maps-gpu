// pull from env action
require('dotenv').config()
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

const { ACCESS_KEY_ID, SECRET_ACCESS_KEY } = process.env

const ROOT_LOCATION = 's2maps-gl'

const REGIONS = [
  'us-east-1',
  'us-west-2',
  'ca-central-1',
  'ap-south-1',
  'ap-northeast-1',
  'ap-southeast-2',
  'eu-central-1',
  'eu-west-2',
  'sa-east-1'
]

// setup version
// const branch = BRANCH
const VERSION = `v${version}`

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

async function storeAll () {
  // first build
  await Promise.all([build(cssCompiler), build(jsCompiler)])
  // store latest version in s2maps.io website if possible
  if (fs.existsSync('../../web/s2maps.io/public/s2maps-gl')) {
    // if folder does not exist, create it
    // if (!fs.existsSync(`../../web/s2maps.io/public/s2maps-gl/${VERSION}`)) {
    if (true) {
      // fs.mkdirSync(`../../web/s2maps.io/public/s2maps-gl/${VERSION}`)
      const files = fs.readdirSync('./buildS2Action')
      for (const file of files) {
        if (file.endsWith('.min.css') || file.endsWith('.min.js')) {
          fs.copyFileSync(`./buildS2Action/${file}`, `../../web/s2maps.io/public/s2maps-gl/${VERSION}/${file}`)
        }
      }
    } else {
      console.log('NO COPY, FOLDER EXISTS')
    }
    // store the latest version
    fs.writeFileSync('../../web/s2maps.io/public/s2maps-gl/latest.js', `export default '${VERSION}'`)
  }
  // store in the cloud
  // for (const region of REGIONS) await store(region)
}

async function store (region) {
  console.log(`Uploading to region "${region}"`)
  const Bucket = `s2mapsio-${region}`
  // setup S3
  const s3 = new S3({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, region, signatureVersion: 'v4' })
  // check if exists already
  const exists = await checkIfExists(s3, Bucket)
  // upload
  if (!exists) await uploadData(s3, Bucket)
}

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

function uploadData (s3, Bucket) {
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
    promises.push(storeFile(s3, Bucket, data, file, contentType))
  }

  return Promise.all(promises)
}

function storeFile (s3, Bucket, Body, name, ContentType) {
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

function checkIfExists (s3, Bucket) {
  return new Promise(resolve => {
    s3.listObjects({ Bucket, Prefix: `${ROOT_LOCATION}/${VERSION}` }, (err, data) => {
      if (err) return resolve(true)
      if (data.Contents.length) return resolve(true)
      resolve(false)
    })
  })
}

storeAll().catch(err => { console.log(err) })
