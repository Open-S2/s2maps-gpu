import baseViteConfig from './vite.config';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

import { glyphApi } from './config/glyphs/glyphs-v1';
import { glyphApiV2 } from './config/glyphs/glyphs-v2';

export default defineConfig({
  ...baseViteConfig,
  base: '',
  plugins: [...(baseViteConfig.plugins ?? []), glyphApi(), glyphApiV2()],
  root: fileURLToPath(new URL('./playground', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  server: {
    port: 3000,
    warmup: {
      clientFiles: [
        './styles/**/*.ts',
        './components/*.{js,ts,jsx,tsx,html,css,svelte,vue}',
        './playground/**/*.{js,ts,jsx,tsx,html,css,svelte,vue}',
      ],
      ssrFiles: [],
    },
  },
});
