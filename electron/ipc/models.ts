import { BrowserWindow, dialog, ipcMain } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { aiManager } from '../ai'
import {
  LLM_MODELS, WHISPER_MODELS, findCatalogModel, isLlmFile, isWhisperFile,
  type CatalogModel, type ModelKind,
} from '../modelCatalog'
import { downloadModel, getDownloadProgress } from '../modelDownloader'
import { getModelsDir, getSettings, updateSettings } from '../settingsStore'

function listModelFiles(modelsDir: string): string[] {
  if (!fs.existsSync(modelsDir)) return []
  return fs.readdirSync(modelsDir)
}

function fileSize(modelsDir: string, file: string): number {
  try {
    return fs.statSync(path.join(modelsDir, file)).size
  } catch {
    return 0
  }
}

function modelStatuses(
  kind: ModelKind, catalog: CatalogModel[], modelsDir: string, files: string[], activeFile: string,
) {
  const isKind = kind === 'whisper' ? isWhisperFile : isLlmFile
  const fromCatalog = catalog.map(m => ({ ...m, custom: false }))
  // Files the user dropped in the folder manually still get a card
  const custom = files
    .filter(f => isKind(f) && !catalog.some(m => m.file === f))
    .map(f => ({
      kind, name: f, file: f, url: '', sizeBytes: fileSize(modelsDir, f), ramBytes: 0,
      note: 'Archivo añadido manualmente a la carpeta de modelos.', custom: true,
    }))

  return [...fromCatalog, ...custom].map(m => {
    const progress = getDownloadProgress(m.file)
    return {
      ...m,
      downloaded: files.includes(m.file),
      active: m.file === activeFile,
      progress: progress ? { received: progress.received, total: progress.total } : null,
    }
  })
}

export function registerModelHandlers() {
  ipcMain.handle('get-models', () => {
    try {
      const files = listModelFiles(getModelsDir())
      return { whisper: files.filter(isWhisperFile), llama: files.filter(isLlmFile) }
    } catch (e) {
      console.error('Failed to read models dir', e)
      return { whisper: [], llama: [] }
    }
  })

  ipcMain.handle('get-model-catalog', () => {
    const modelsDir = getModelsDir()
    const files = listModelFiles(modelsDir)
    const settings = getSettings()
    return {
      modelsDir,
      totalMemBytes: os.totalmem(),
      whisper: modelStatuses('whisper', WHISPER_MODELS, modelsDir, files, settings.whisperModel),
      llm: modelStatuses('llm', LLM_MODELS, modelsDir, files, settings.llmModel),
    }
  })

  ipcMain.handle('select-models-path', async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Seleccionar carpeta de modelos',
      defaultPath: getModelsDir(),
      properties: ['openDirectory', 'createDirectory'],
    }
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) return null

    const selected = result.filePaths[0]
    fs.mkdirSync(selected, { recursive: true })
    updateSettings({ modelsPath: selected })

    // The active LLM may exist (or not) in the new folder
    aiManager.ensureLlama().catch(e => console.error('Failed to reload LLM after path change', e))
    return selected
  })

  ipcMain.handle('download-model', async (event, file: string) => {
    const model = findCatalogModel(file)
    if (!model) throw new Error(`Modelo desconocido: ${file}`)

    await downloadModel(model, getModelsDir(), progress => {
      if (!event.sender.isDestroyed()) event.sender.send('model-download-progress', progress)
    })
  })

  ipcMain.handle('activate-model', async (_event, kind: ModelKind, file: string) => {
    const name = path.basename(file)
    if (!fs.existsSync(path.join(getModelsDir(), name))) {
      throw new Error(`El modelo no está descargado: ${name}`)
    }
    const settings = updateSettings(kind === 'whisper' ? { whisperModel: name } : { llmModel: name })
    if (kind === 'llm') await aiManager.ensureLlama()
    return settings
  })
}
