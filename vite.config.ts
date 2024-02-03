import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['@vitest/web-worker'],
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:8008',
      NODE_ENV: 'test'
    },
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    typecheck: {
      tsconfig: './tsconfig.next.json'
    }
  },
  resolve: {
    alias: {
      s2: path.resolve(__dirname, './s2')
    }
  }
})
