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
              external: ['node-llama-cpp']
            }
          }
        }
      },
      {
        // LLM runs in a utility process (see electron/ai.ts). Without onstart the plugin
        // would launch a second Electron app for this entry.
        entry: 'electron/llmWorker.ts',
        onstart() {},
        vite: {
          build: {
            rollupOptions: {
              external: ['node-llama-cpp']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          plugins: [{
            // Sandboxed preloads (Electron's default) can't run ESM `import` statements.
            // The plugin picks ESM from "type": "module" and array options get concatenated
            // on merge, so the format is replaced here instead of in build.lib.
            name: 'preload-cjs-only',
            config(config) {
              config.build!.lib = {
                entry: 'electron/preload.ts',
                formats: ['cjs'],
                fileName: () => 'preload.cjs',
              }
            },
          }],
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
        'reglas-gramaticales-estilo': resolve(__dirname, 'pages/reglas-gramaticales-estilo.html')
      }
    }
  }
})
