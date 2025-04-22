// NOTE: The dist folder must have been created for s2 library FIRST before building the framework
import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import eslint from 'vite-plugin-eslint2';
import { svelte } from 'vite-plugin-svelte';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: __dirname,
  plugins: [
    AutoImport({
      imports: ['svelte', 'react', 'svelte/store', 'vue/macros', 'vue'],
      dts: './auto-imports.d.ts', // generates types
    }),
    eslint(),
    vue(),
    svelte(),
    dts(),
  ],
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue', '.svelte'],
  },
  build: {
    lib: {
      entry: './index.ts',
      name: 'MyLib',
      formats: ['es'],
      // fileName: (format): string => `out.${format}.js`,
    },
    outDir: 'dist',
    rollupOptions: {
      external: ['vue', 'svelte', 'react'],
      output: {
        globals: {
          react: 'React',
          vue: 'Vue',
          svelte: 'Svelte',
        },
      },
    },
  },
});
