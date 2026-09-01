import { fileURLToPath, URL } from 'node:url'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * S3 website hosting serves `error_document` for unknown keys. Emitting a copy of
 * index.html as 404.html makes history-mode deep links work on a plain bucket,
 * with no CloudFront function required.
 */
function spaFallbackPlugin(outDir: string): Plugin {
  return {
    name: 'affogata:spa-fallback',
    apply: 'build',
    closeBundle() {
      const index = resolve(outDir, 'index.html')
      if (existsSync(index)) copyFileSync(index, resolve(outDir, '404.html'))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const outDir = resolve(process.cwd(), 'dist')

  return {
    base: env.VITE_BASE || '/',
    plugins: [vue(), spaFallbackPlugin(outDir)],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      outDir,
      target: 'es2022',
      cssCodeSplit: false,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue', 'vue-router', 'pinia'],
          },
        },
      },
    },
  }
})
