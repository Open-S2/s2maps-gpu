import parse from './parse'

import type { BunPlugin } from 'bun'

const GlslPlugin: BunPlugin = {
  name: 'GLSL loader',
  setup (build) {
    build.onLoad({ filter: /\.glsl$/ }, async (args) => {
      const { path } = args
      // get the contents of the file
      const shader = await Bun.file(path).text()
      return {
        contents: parse(path, shader),
        loader: 'js'
      }
    })
  }
}

export default GlslPlugin
