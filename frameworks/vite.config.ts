// NOTE: The dist folder must have been created for s2 library FIRST before building the framework
import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import vue from '@vitejs/plugin-vue';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  root: __dirname,
  plugins: [
    AutoImport({
      imports: ['svelte', 'react', 'svelte/store', 'vue/macros', 'vue'],
      dts: './auto-imports.d.ts', // generates types
    }),
    vue({ customElement: true }),
    svelte({
      preprocess: vitePreprocess(),
      compilerOptions: {
        css: 'injected', // inline CSS instead of extracting
        // generate: 'dom', // or 'ssr' if targeting server
        dev: false,
        runes: true,
      },
      emitCss: false, // disable CSS extraction
      exclude: undefined,
    }),
    dts({ entryRoot: '.', outDir: 'dist' }),
  ],
  resolve: {
    extensions: ['.ts', '.jsx', '.tsx', '.json', '.vue', '.svelte'],
  },
  build: {
    cssCodeSplit: false,
    sourcemap: true,
    lib: {
      entry: './index.ts',
      name: 'lib',
      formats: ['es'],
      fileName: 'index',
    },
    outDir: 'dist',
    rollupOptions: {
      external: [
        'vue',
        'vue-class-component',
        'vue-property-decorator',
        'vuex',
        'vuex-class',
        'svelte',
        'svelte/internal',
        'svelte/store',
        'react',
      ],
    },
  },
});
