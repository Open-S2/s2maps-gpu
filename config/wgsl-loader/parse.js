const fs = require('fs')

module.exports = function (path, contents) {
  return `export default "${parse(path, contents)}"\n`
}

function parse (path, contents) {
  const relativePath = path.split('/').slice(0, -1).join('/')
  return _parse(relativePath, contents)
}

function _parse (relativePath, contents) {
  const lines = contents.split('\n')
  const splitContents = []
  for (const line of lines) {
    if (line.startsWith('#include')) {
      let includePath = line.split(' ')[1]
      includePath = includePath.slice(0, -1)
      const fullPath = `${relativePath}/${includePath}`
      const subContents = fs.readFileSync(fullPath, 'utf8')
      splitContents.push(parse(fullPath, subContents))
    } else {
      splitContents.push(line)
    }
  }
  return sanitizeStringForExport(splitContents.join('\n'))
}

function sanitizeStringForExport (str) {
  // Remove single-line comments
  str = str.replace(/\/\/.*$/gm, '')
  // Remove multi-line comments
  str = str.replace(/\/\*[\s\S]*?\*\//g, '')
  // Replace line breaks with '\n'
  str = str.replace(/\n/g, '\\n')
  // Escape double quotes
  str = str.replace(/"/g, '\\"')
  return str
}
