import { BrowserWindow } from 'electron'
import { join } from 'path'

let win: BrowserWindow | null = null;

export function getMainWindow() { return win; }

export function createWindow(preload: string, indexHtml: string) {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: true,
    titleBarStyle: 'hiddenInset',
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
    win.loadFile(indexHtml)
  }
  return win;
}
