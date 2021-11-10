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
const { S3 } = require('aws-sdk')
const { getInput, info, setFailed, setOutput } = require('@actions/core')
const { makeKey } = require('./makekey')

// CLEAN UP FROM OLD BUILD
const dirPath = path.join(__dirname, '../buildS2Action')
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
    // upload
    uploadData()
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
  } else { console.log('Directory path not found.') }
}

function uploadData () {
  try {
    const accessKeyId = getInput('access_key_id')
    const secretAccessKey = getInput('secret_access_key')

    const s3 = new S3({ accessKeyId, secretAccessKey })

    const fileName = getInput('path')
    const bucket = getInput('bucket')
    const key = makeKey({
      key: getInput('key'),
      root: getInput('bucket_root')
    })

    uploadFile({ s3, fileName, bucket, key })
  } catch ({ message }) { setFailed(message) }
}

function uploadFile (s3, fileName, bucket, key) {
  const fileContent = fs.readFileSync(fileName)
  const params = { Bucket: bucket, Key: key, Body: fileContent }

  return new Promise((resolve, reject) => {
    try {
      s3.upload(params, (err, data) => {
        if (err) {
          throw err
        }
        info(`Uploaded ${fileName} to ${data.Location}`)
        setOutput('object_path', data.Location)
      })
    } catch ({ message }) {
      setFailed(message)
    }
  })
}
