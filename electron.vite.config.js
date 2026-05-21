import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: path.resolve('src/main/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js'
      },
      outDir: 'out/main'
    }
  },
  preload: {
    build: {
      lib: {
        entry: path.resolve('src/preload/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js'
      },
      outDir: 'out/preload'
    }
  },
  renderer: {
    root: path.resolve('src/renderer'),
    build: {
      outDir: path.resolve('out/renderer'),
      rollupOptions: {
        input: path.resolve('src/renderer/index.html')
      }
    },
    plugins: [tailwindcss(), react()]
  }
})
