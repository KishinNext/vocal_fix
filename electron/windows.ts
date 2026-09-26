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
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
    } else {
      callback(false)
    }
  })

  // Intercept window.open() calls so they open as proper Electron windows
  // Note: use the `preload` parameter directly — __dirname is not available in ESM
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`[window.open] intercepted: ${url}`)
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1100,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        titleBarStyle: 'hiddenInset' as const,
        icon: join(process.env.PUBLIC || '', 'logo.png'),
        webPreferences: {
          preload,
          nodeIntegration: false,
          contextIsolation: true,
        },
        show: false,
      },
    }
  })

  // Show newly created child windows once they're ready
  win.webContents.on('did-create-window', (childWin) => {
    childWin.once('ready-to-show', () => {
      childWin.show()
      childWin.focus()
    })
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
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    icon: join(process.env.PUBLIC || '', 'logo.png'),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Show only when content is ready to avoid white flash
  settingsWin.once('ready-to-show', () => {
    settingsWin?.show()
    settingsWin?.focus()
  })

  // Log load errors so we can debug silently failing windows
  settingsWin.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[settings window] Failed to load: ${validatedURL} — ${errorCode} ${errorDescription}`)
  })

  settingsWin.webContents.on('dom-ready', () => {
    console.log('[settings window] DOM ready — window loaded OK')
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    const baseUrl = process.env.VITE_DEV_SERVER_URL.replace(/\/$/, '')
    const url = `${baseUrl}/pages/settings.html`
    console.log(`[settings window] Loading dev URL: ${url}`)
    settingsWin.loadURL(url)
  } else {
    console.log(`[settings window] Loading file: ${settingsHtml}`)
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
