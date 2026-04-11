import { defineConfig } from 'vite'

export default defineConfig({
  // Root is the project root (where index.html lives)
  root: '.',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },

  server: {
    port: 3000,
    open: true,
  },
})
