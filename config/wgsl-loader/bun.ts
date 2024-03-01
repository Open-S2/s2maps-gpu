import type { BunPlugin } from 'bun'

// TODO: Some shaders may #include inside an already #included file. This is not supported yet.

const WgslPlugin: BunPlugin = {
  name: 'WGSL loader',
  setup (build) {
    build.onLoad({ filter: /\.wgsl$/ }, async (args) => {
      const { path } = args
      // load the file:
      const file = await Bun.file(path).text()
      const basePath = path.split('/').slice(0, -1).join('/')
      // for each line, if a line starts with #include, replace it with the contents of the file
      const lines = file.split('\n')
      const contents: string[] = []
      for (const line of lines) {
        if (line.startsWith('#include')) {
          let includePath = line.split(' ')[1]
          includePath = includePath.slice(0, -1)
          const includeFile = await Bun.file(`${basePath}/${includePath}`).text()
          contents.push(includeFile)
        } else {
          contents.push(line)
        }
      }
      const result = contents.join('\n')
      return {
        contents: `export default "${sanitizeStringForExport(result)}"`,
        loader: 'js'
      }
    })
  }
}

function sanitizeStringForExport (str: string): string {
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

export default WgslPlugin
