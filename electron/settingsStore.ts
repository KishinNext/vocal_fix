import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { sanitizeSettings, type AppSettings } from './settingsSchema'

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')

export function getSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return sanitizeSettings(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')))
    }
  } catch (e) {
    console.error('Failed to read settings, using defaults', e)
  }
  return sanitizeSettings({})
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = sanitizeSettings(patch, getSettings())
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to write settings', e)
  }
  return next
}

// In dev, models live in <repo>/models (same folder scripts/download-models.js uses).
// A packaged app's resources are read-only, so default to userData there.
export function getModelsDir(): string {
  const configured = getSettings().modelsPath
  if (configured) return configured
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'models')
    : path.join(app.getAppPath(), 'models')
}
