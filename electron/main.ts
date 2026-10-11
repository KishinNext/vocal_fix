import { app, BrowserWindow, globalShortcut } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { aiManager } from './ai'
import { registerAppScheme, serveApp } from './appProtocol'
import { whisperServer } from './whisperServer'
import { checkForUpdates } from './updates'
import { createWindow } from './windows'
import { registerIpcHandlers, registerRecordShortcut } from './ipc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

process.env.DIST = join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

const preload = join(__dirname, './preload.cjs')
const dist = process.env.DIST

registerAppScheme()

app.setName('VocalFix');
if (process.platform === 'darwin') {
  app.dock?.setIcon(join(process.env.PUBLIC || '', 'logo.png'));
}

app.whenReady().then(() => {
  serveApp(dist)
  registerIpcHandlers()
  const mainWindow = createWindow(preload)
  registerRecordShortcut()

  // Warm both models up once the editor has rendered: loading takes seconds and used to
  // delay the window. Requests made before they finish wait for them.
  mainWindow.webContents.once('did-finish-load', () => {
    aiManager.ensureLlama().catch(e => console.error('Failed to load LLM', e))
    whisperServer.ensure().catch(e => console.warn('Whisper server not started:', e.message))
    void checkForUpdates()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(preload)
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  whisperServer.stop()
  aiManager.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

