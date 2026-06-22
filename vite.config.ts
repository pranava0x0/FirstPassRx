/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site is served from https://<user>.github.io/FirstPassRx/,
// so every asset URL must be prefixed with the repo name. `base` does that.
// If you fork to a repo with a different name, change this to "/<repo>/".
export default defineConfig({
  base: '/FirstPassRx/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
