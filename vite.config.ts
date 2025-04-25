import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import glsl from './config/glsl-loader/vite.js';
import react from '@vitejs/plugin-react';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import vue from '@vitejs/plugin-vue';
import wgsl from './config/wgsl-loader/vite.js';

export default defineConfig({
  root: '.',
  optimizeDeps: {
    include: [
      'open-vector-tile',
      'earclip',
      'unicode-shaper',
      'react',
      'react-dom',
      'vue',
      'svelte',
    ],
  },
  plugins: [
    svelte(),
    vue(),
    react(),
    glsl(),
    wgsl(),
    AutoImport({
      imports: ['svelte', 'react', 'svelte/store', 'vue/macros', 'vue'],
      dts: './auto-imports.d.ts', // generates types
    }),
  ],
  worker: {
    format: 'es',
    /** @returns the inject plugins */
    plugins: () => [glsl(), wgsl()],
  },
  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
      s2: fileURLToPath(new URL('./s2', import.meta.url)),
      'gis-tools': fileURLToPath(new URL('./s2/gis-tools', import.meta.url)),
      gl: fileURLToPath(new URL('./s2/gl', import.meta.url)),
      gpu: fileURLToPath(new URL('./s2/gpu', import.meta.url)),
      plugins: fileURLToPath(new URL('./s2/plugins', import.meta.url)),
      source: fileURLToPath(new URL('./s2/source', import.meta.url)),
      style: fileURLToPath(new URL('./s2/style', import.meta.url)),
      svg: fileURLToPath(new URL('./s2/svg', import.meta.url)),
      ui: fileURLToPath(new URL('./s2/ui', import.meta.url)),
      util: fileURLToPath(new URL('./s2/util', import.meta.url)),
      workers: fileURLToPath(new URL('./s2/workers', import.meta.url)),
    },
  },
});
