import { app, BrowserWindow } from 'electron'
import { join } from 'path'

let win: BrowserWindow | null = null;
let settingsWin: BrowserWindow | null = null;

export function createWindow(preload: string, indexHtml: string) {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    icon: join(process.env.PUBLIC || '', 'logo.png'),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Automatically allow microphone permissions
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
    } else {
      callback(false)
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(indexHtml)
  }
  return win;
}

export function createSettingsWindow(preload: string, settingsHtml: string) {
  if (settingsWin) {
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    icon: join(process.env.PUBLIC || '', 'logo.png'),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    const baseUrl = process.env.VITE_DEV_SERVER_URL;
    const url = baseUrl.endsWith('/') ? `${baseUrl}settings.html` : `${baseUrl}/settings.html`;
    settingsWin.loadURL(url)
  } else {
    settingsWin.loadFile(settingsHtml)
  }

  settingsWin.on('closed', () => {
    settingsWin = null
  })
}

export function restoreWindow() {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Requires recreate, usually app.on('activate')
  }
}
