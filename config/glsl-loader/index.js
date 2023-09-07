// @refresh reset
// TODO: https://github.com/leosingleton/webpack-glsl-minify migrate to this
// TODO: also migrate this: https://github.com/vanruesc/esbuild-plugin-glsl/blob/main/src/index.ts
// maybe pick and choose what's useful from both
const parse = require('./parse')

module.exports = function (source) {
  // @refresh reset
  return parse(this.resource, source)
  // this.callback(null, `export default ${JSON.stringify(parse(this.resource, source))}`)
}

// 'use strict'

// const fs = require('fs')
// const path = require('path')

// function parse (loader, source, context, cb) {
//   const imports = []
//   const importPattern = /@import "([.\/\w_-]+)"/gi
//   let match = importPattern.exec(source)

//   while (match != null) {
//     imports.push({
//       key: match[1],
//       target: match[0],
//       content: ''
//     })
//     match = importPattern.exec(source)
//   }

//   processImports(loader, source, context, imports, cb)
// }

// function processImports (loader, source, context, imports, cb) {
//   if (imports.length === 0) {
//     return cb(null, source)
//   }

//   const imp = imports.pop()

//   loader.resolve(context, './' + imp.key, function (err, resolved) {
//     if (err) {
//       return cb(err)
//     }

//     loader.addDependency(resolved)
//     fs.readFile(resolved, 'utf-8', function (err, src) {
//       if (err) {
//         return cb(err)
//       }

//       parse(loader, src, path.dirname(resolved), function (err, bld) {
//         if (err) {
//           return cb(err)
//         }

//         source = source.replace(imp.target, bld)
//         processImports(loader, source, context, imports, cb)
//       })
//     })
//   })
// }

// module.exports = function (source) {
//   this.cacheable()
//   const cb = this.async()
//   parse(this, source, this.context, function (err, bld) {
//     if (err) return cb(err)
//     cb(null, 'module.exports = ' + JSON.stringify(bld))
//   })
// }
