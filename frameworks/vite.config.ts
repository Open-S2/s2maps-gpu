// NOTE: The dist folder must have been created for s2 library FIRST before building the framework
import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import eslint from 'vite-plugin-eslint2';
import vue from '@vitejs/plugin-vue';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// import sveltePreprocess from 'svelte-preprocess';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: __dirname,
  plugins: [
    AutoImport({
      imports: ['svelte', 'react', 'svelte/store', 'vue/macros', 'vue'],
      dts: './auto-imports.d.ts', // generates types
    }),
    tsconfigPaths(),
    eslint(),
    vue(),
    svelte({ preprocess: vitePreprocess({ script: true }) }),
    dts({
      entryRoot: '.',
      outDir: 'dist',
    }),
  ],
  resolve: {
    extensions: ['.ts', '.jsx', '.tsx', '.json', '.vue', '.svelte'],
  },
  build: {
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
        'react',
      ],
    },
  },
});
