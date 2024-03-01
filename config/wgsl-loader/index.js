const parse = require('./parse')

module.exports = function (source) {
  // @refresh reset
  return parse(this.resource, source)
}
