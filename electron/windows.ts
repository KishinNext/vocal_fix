import { BrowserWindow } from 'electron'
import { join } from 'path'
import { APP_URL } from './appProtocol'

let win: BrowserWindow | null = null;

export function getMainWindow() { return win; }

export function createWindow(preload: string) {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: true,
    // macOS draws its window buttons over the page header; elsewhere the native frame stays
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    icon: join(process.env.PUBLIC || '', 'logo.png'),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Automatically allow microphone permissions
  win.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadURL(APP_URL)
  }
  return win;
}
