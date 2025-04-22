// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  future: { compatibilityVersion: 4 },
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  modules: [
    '@nuxt/content',
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/ui'
  ],
  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
  },

  nitro: {
    prerender: {
      routes: ['/api/search.json'],
      autoSubfolderIndex: false,
    },
  },

  ui: {
    theme: {
      colors: [
        'primary',
        'secondary',
        'tertiary',
        'info',
        'success',
        'warning',
        'error'
      ]
    },
    // icons: ['heroicons', 'simple-icons', 'ph'],
  },

  content: {
    build: {
      markdown: {
        highlight: {
          // // Theme used in all color schemes.
          // theme: 'github-light',
          // // OR
          // theme: {
          //   // Default theme (same as single string)
          //   default: 'github-light',
          //   // Theme used if `html.dark`
          //   dark: 'github-dark',
          //   // Theme used if `html.sepia`
          //   sepia: 'monokai'
          // }
          langs: ['javascript', 'html', 'typescript', 'svelte', 'vue', 'vue-html', 'tsx', 'json', 'json5', 'markdown', 'css', 'rust']
          // 'javascript', 'typescript', 'markdown', 'vue', 'vue-html', 'zig', 'tsx', 'html', 'svelte', 'css', 'text'
        }
      }
    }
  }
})