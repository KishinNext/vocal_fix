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

app.whenReady().then(async () => {
  await aiManager.init().catch(e => console.error('Failed to init AI', e))
  createWindow(preload, indexHtml)
  registerIpcHandlers()
  registerRecordShortcut()

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

