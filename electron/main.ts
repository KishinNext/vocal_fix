import { app, BrowserWindow, globalShortcut } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { aiManager } from './ai'
import { createWindow } from './windows'
import { registerIpcHandlers, registerRecordShortcut } from './ipc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

process.env.DIST = join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

const preload = join(__dirname, './preload.cjs')
const indexHtml = join(process.env.DIST, 'index.html')

app.setName('VocalFix');
if (process.platform === 'darwin') {
  app.dock?.setIcon(join(process.env.PUBLIC || '', 'logo.png'));
}

app.whenReady().then(() => {
  registerIpcHandlers()
  const mainWindow = createWindow(preload, indexHtml)
  registerRecordShortcut()

  // Warm the LLM up once the editor has rendered: loading takes seconds and used to
  // delay the window. Corrections requested before it finishes wait for it (ensureLlama).
  mainWindow.webContents.once('did-finish-load', () => {
    aiManager.init().catch(e => console.error('Failed to init AI', e))
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(preload, indexHtml)
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

