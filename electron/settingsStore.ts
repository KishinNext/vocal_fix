import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { sanitizeSettings, type AppSettings } from './settingsSchema'

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')

// This process is the only writer, so the file is read once and cached;
// updates write through.
let cached: AppSettings | null = null

function readSettingsFile(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return sanitizeSettings(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')))
    }
  } catch (e) {
    console.error('Failed to read settings, using defaults', e)
  }
  return sanitizeSettings({})
}

export function getSettings(): AppSettings {
  cached ??= readSettingsFile()
  return cached
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  cached = sanitizeSettings(patch, getSettings())
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(cached, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to write settings', e)
  }
  return cached
}

// In dev, models live in <repo>/models.
// A packaged app's resources are read-only, so default to userData there.
export function getModelsDir(): string {
  const configured = getSettings().modelsPath
  if (configured) return configured
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'models')
    : path.join(app.getAppPath(), 'models')
}
