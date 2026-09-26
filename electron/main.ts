import { app, BrowserWindow } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initAI } from './ai'
import { createWindow } from './windows'
import { registerIpcHandlers } from './ipcHandlers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

process.env.DIST = join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

const preload = join(__dirname, './preload.js')
const indexHtml = join(process.env.DIST, 'index.html')
const settingsHtml = join(process.env.DIST, 'settings.html')

app.whenReady().then(async () => {
  await initAI()
  const mainWindow = createWindow(preload, indexHtml)
  registerIpcHandlers(preload, settingsHtml)

  // Send memory stats continuously
  setInterval(async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const memInfo = await process.getProcessMemoryInfo();
      const memoryGB = (memInfo.residentSet / 1024).toFixed(1) + ' GB';
      mainWindow.webContents.send('memory-stats', memoryGB);
    }
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(preload, indexHtml)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

