import { ipcMain } from 'electron'
import { buildSystemPrompt } from '../prompt'
import type { AppSettings } from '../settingsSchema'
import { getSettings, updateSettings } from '../settingsStore'
import { applyRecordShortcut } from '../shortcuts'
import { getMainWindow } from '../windows'

// Renderer-editable settings. Models and the shortcut have dedicated handlers
// because changing them has side effects (loading a model, registering a hotkey).
const EDITABLE_KEYS: (keyof AppSettings)[] = [
  'language', 'intervention', 'temperature', 'profile', 'rules', 'glossary',
]

function toggleRecordingInEditor() {
  const mainWindow = getMainWindow()
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('toggle-recording')
}

export function registerRecordShortcut() {
  const { recordShortcut } = getSettings()
  if (!applyRecordShortcut(recordShortcut, toggleRecordingInEditor)) {
    console.warn(`Could not register global shortcut: ${recordShortcut}`)
  }
}

export function registerSettingsHandlers() {
  ipcMain.handle('get-settings', () => getSettings())

  ipcMain.handle('update-settings', (_event, patch: Partial<AppSettings>) => {
    const allowed = Object.fromEntries(
      Object.entries(patch ?? {}).filter(([key]) => EDITABLE_KEYS.includes(key as keyof AppSettings)),
    )
    return updateSettings(allowed)
  })

  ipcMain.handle('get-system-prompt', () => buildSystemPrompt(getSettings()))

  ipcMain.handle('set-record-shortcut', (_event, accelerator: string) => {
    if (!applyRecordShortcut(accelerator, toggleRecordingInEditor)) {
      return { ok: false, settings: getSettings() }
    }
    return { ok: true, settings: updateSettings({ recordShortcut: accelerator }) }
  })
}
