import findCacheDir from 'find-cache-dir'
import { join } from 'node:path'

import type { BuildConfig, BunPlugin, PluginBuilder } from 'bun'

const InlineWorkerPlugin: BunPlugin = {
  name: 'WGSL loader',
  async setup (build: PluginBuilder): Promise<void> {
    build.onLoad(
      { filter: /\.worker\.(js|jsx|ts|tsx)$/ },
      async ({ path: workerPath }) => {
        const workerCode = await buildWorker(workerPath, build.config)
        return {
          contents: `import inlineWorker from '__inline-worker'
export default function Worker() {
  return inlineWorker(${JSON.stringify(workerCode)});
}
`,
          loader: 'js'
        }
      }
    )

    // TODO: add name next to the worker type: 'module'
    const inlineWorkerFunctionCode = `
export default function inlineWorker(scriptText) {
  let blob = new Blob([scriptText], {type: 'text/javascript'});
  let url = URL.createObjectURL(blob);
  let worker = new Worker(url, ${JSON.stringify({ type: 'module' })});
  URL.revokeObjectURL(url);
  return worker;
}
`

    build.onResolve({ filter: /^__inline-worker$/ }, ({ path }) => {
      return { path, namespace: 'inline-worker' }
    })
    build.onLoad({ filter: /.*/, namespace: 'inline-worker' }, () => {
      return { contents: inlineWorkerFunctionCode, loader: 'js' }
    })
  }
}

export default InlineWorkerPlugin

const cacheDir = findCacheDir({
  name: 'esbuild-plugin-inline-worker',
  create: true
}) ?? join(__dirname, '.cache')

async function buildWorker (workerPath: string, config: BuildConfig): Promise<string> {
  const scriptName = workerPath.split('/').pop() ?? 'worker.js'
  const bundlePath = join(cacheDir, scriptName)

  await Bun.build({
    ...config,
    entrypoints: [workerPath],
    minify: true,
    outdir: cacheDir,
    naming: scriptName
  })

  return await Bun.file(bundlePath).text()
}
