import { BrowserWindow, ipcMain } from 'electron'
import { checkForUpdates, getUpdateState, installUpdate, onUpdateState } from '../updates'

export function registerUpdateHandlers() {
  ipcMain.handle('get-update-state', () => getUpdateState())
  ipcMain.handle('check-updates', () => checkForUpdates(true))
  ipcMain.handle('install-update', () => installUpdate())

  onUpdateState(state => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('update-state', state)
    }
  })
}
