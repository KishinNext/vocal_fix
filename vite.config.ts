import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  plugins: [
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['node-llama-cpp', 'whisper-node']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
      },
    ]),
    renderer(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'pages/settings.html'),
        'atajos-teclado-hotkeys': resolve(__dirname, 'pages/atajos-teclado-hotkeys.html'),
        'reglas-gramaticales-estilo': resolve(__dirname, 'pages/reglas-gramaticales-estilo.html'),
        'almacenamiento-privacidad': resolve(__dirname, 'pages/almacenamiento-privacidad.html'),
        'rendimiento-hardware': resolve(__dirname, 'pages/rendimiento-hardware.html')
      }
    }
  }
})
