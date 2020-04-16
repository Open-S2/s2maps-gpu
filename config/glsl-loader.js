'use strict'

const { getOptions } = require('loader-utils')

const fs = require('fs')
const path = require('path')

function parse (loader, source, context, cb) {
  let imports = []
  let importPattern = /#include ([.\/\w_-]+);/gi
  let match = importPattern.exec(source)

  while (match != null) {
    imports.push({
      key: match[1],
      target: match[0],
      content: ''
    })
    match = importPattern.exec(source)
  }

  processImports(loader, source, context, imports, cb)
}

function processImports (loader, source, context, imports, cb) {
  if (imports.length === 0) {
    return cb(null, source)
  }

  let imp = imports.pop()

  loader.resolve(context, imp.key + '.glsl', function (err, resolved) {
    if (err) {
      return cb(err)
    }

    loader.addDependency(resolved)
    fs.readFile(resolved, 'utf-8', function (err, src) {
      if (err) {
        return cb(err)
      }

      parse(loader, src, path.dirname(resolved), function (err, bld) {
        if (err) {
          return cb(err)
        }

        source = source.replace(imp.target, bld)
        processImports(loader, source, context, imports, cb)
      })
    })
  })
}

module.exports = function (source, map) {
  const options = getOptions(this) || {}
  this.cacheable()
  let cb = this.async()
  parse(this, source, this.context, function (err, bld) {
    if (err) {
      return cb(err)
    }

    // remove comments
    // bld = bld.replace(/(\/\*([\s\S]*?)\*\/)|(\/\/(.*)$)/gm, '')

    cb(null, 'module.exports = ' + JSON.stringify(bld), map)
  })
}
