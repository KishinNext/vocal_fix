import { ipcMain } from 'electron'
import { DEFAULT_PROMPTS, buildGrammarPrompt, buildSystemPrompt, type PromptsResponse } from '../prompt'
import type { AppSettings } from '../settingsSchema'
import { getSettings, updateSettings } from '../settingsStore'
import { applyRecordShortcut } from '../shortcuts'
import { whisperServer } from '../whisperServer'
import { getMainWindow } from '../windows'

// Renderer-editable settings. Models and the shortcut have dedicated handlers
// because changing them has side effects (loading a model, registering a hotkey).
const EDITABLE_KEYS: (keyof AppSettings)[] = [
  'language', 'intervention', 'temperature', 'profile', 'rules', 'glossary', 'prompts',
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
    const previousLanguage = getSettings().language
    const settings = updateSettings(allowed)
    // The server is started for one language: restart it now rather than on the next utterance
    if (settings.language !== previousLanguage) {
      whisperServer.ensure().catch(e => console.warn('Whisper server not restarted after language change:', e.message))
    }
    return settings
  })

  ipcMain.handle('get-prompts', (): PromptsResponse => {
    const settings = getSettings()
    return {
      defaults: DEFAULT_PROMPTS,
      sent: { grammar: buildGrammarPrompt(settings), natural: buildSystemPrompt(settings) },
    }
  })

  ipcMain.handle('set-record-shortcut', (_event, accelerator: string) => {
    if (!applyRecordShortcut(accelerator, toggleRecordingInEditor)) {
      return { ok: false, settings: getSettings() }
    }
    return { ok: true, settings: updateSettings({ recordShortcut: accelerator }) }
  })
}
