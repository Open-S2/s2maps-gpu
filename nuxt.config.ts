import { fileURLToPath } from 'url'
import wgsl from './config/wgsl-loader/vite'
import glsl from './config/glsl-loader/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      state: process.env.STATE ?? 'prod',
      apiURL: process.env.API_URL ?? 'https://api.opens2.com',
      dataURL: process.env.DATA_URL ?? 'https://api.opens2.com',
      baseURL: process.env.BASE_URL ?? 'https://opens2.com'
    }
  },
  watch: [
    './s2/**/*',
    './components/**/*',
    './pages/**/*',
    './plugins/**/*',
    './public/**/*'
  ],
  modules: process.env.DEV === 'true'
    ? [
        // 'nuxtjs-eslint-module'
      ]
    : [],
  css: [
    fileURLToPath(new URL('./assets/styles/globals.css', import.meta.url))
  ],
  vite: {
    plugins: [wgsl(), glsl()]
  },
  alias: {
    s2: fileURLToPath(new URL('./s2', import.meta.url)),
    geometry: fileURLToPath(new URL('./s2/geometry', import.meta.url)),
    gl: fileURLToPath(new URL('./s2/gl', import.meta.url)),
    gpu: fileURLToPath(new URL('./s2/gpu', import.meta.url)),
    plugins: fileURLToPath(new URL('./s2/plugins', import.meta.url)),
    source: fileURLToPath(new URL('./s2/source', import.meta.url)),
    style: fileURLToPath(new URL('./s2/style', import.meta.url)),
    svg: fileURLToPath(new URL('./s2/svg', import.meta.url)),
    ui: fileURLToPath(new URL('./s2/ui', import.meta.url)),
    util: fileURLToPath(new URL('./s2/util', import.meta.url)),
    workers: fileURLToPath(new URL('./s2/workers', import.meta.url))
  }
})
