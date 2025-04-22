// import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte'],
  preprocess: vitePreprocess(),
  // kit: {
  //   adapter: adapter(),
  // },
  // plugin options
  vitePlugin: {
    exclude: [],
    // experimental options
    experimental: {},
  },
};

export default config;
