// const fsPromise = require('fs').promises
const parse = require('./parse')

// const { loader } = require('webpack')
// const { getOptions } = require('loader-utils')

// module.exports = function (source) {
// 	const callback = this.async()
// 	(async () => {
// 		// rebuild the glsl file
//     const ASSET_PATH = process.env.ASSET_PATH || "/"
//     const glsl = parse(ASSET_PATH, source)
//     console.log('ASSET_PATH', ASSET_PATH)
//     console.log('source', source)
//     // return
// 		return `export default ${JSON.stringify(glsl)}`
// 	})().then((res) => callback(undefined, res), (err) => callback(err))
// }

module.exports = function (source) {
  return parse(this.resource, source)
  // this.callback(null, `export default ${JSON.stringify(parse(this.resource, source))}`)
}
