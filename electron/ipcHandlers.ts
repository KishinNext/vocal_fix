import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { getMainWindow } from './windows'
import { saveWavFile } from './audioService'
import { transcribeAudio, fixGrammar, aiManager } from './ai'
import { getModelsDir, getSettings, updateSettings } from './settingsStore'
import type { AppSettings } from './settingsSchema'
import {
  LLM_MODELS, WHISPER_MODELS, findCatalogModel, isLlmFile, isWhisperFile,
  type CatalogModel, type ModelKind,
} from './modelCatalog'
import { downloadModel, getDownloadProgress } from './modelDownloader'
import { applyRecordShortcut } from './shortcuts'
import { buildSystemPrompt } from './prompt'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Renderer-editable settings. Models and the shortcut have dedicated handlers
// because changing them has side effects (loading a model, registering a hotkey).
const EDITABLE_KEYS: (keyof AppSettings)[] = [
  'language', 'intervention', 'temperature', 'profile', 'rules', 'glossary',
]

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

export function registerIpcHandlers() {
  ipcMain.handle('get-models', async () => {
    try {
      const files = listModelFiles(getModelsDir());
      return { whisper: files.filter(isWhisperFile), llama: files.filter(isLlmFile) };
    } catch (e) {
      console.error('Failed to read models dir', e);
      return { whisper: [], llama: [] };
    }
  });

  ipcMain.handle('select-models-path', async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      title: 'Seleccionar carpeta de modelos',
      defaultPath: getModelsDir(),
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) return null;

    const selected = result.filePaths[0];
    fs.mkdirSync(selected, { recursive: true });
    updateSettings({ modelsPath: selected });

    // The active LLM may exist (or not) in the new folder
    aiManager.ensureLlama().catch(e => console.error('Failed to reload LLM after path change', e));
    return selected;
  });

  ipcMain.handle('get-settings', () => getSettings());

  ipcMain.handle('update-settings', (_event, patch: Partial<AppSettings>) => {
    const allowed = Object.fromEntries(
      Object.entries(patch ?? {}).filter(([key]) => EDITABLE_KEYS.includes(key as keyof AppSettings)),
    );
    return updateSettings(allowed);
  });

  // Re-corrects existing text (e.g. after switching tone in the editor) without re-recording
  ipcMain.handle('fix-grammar', (_event, text: string) => fixGrammar(String(text ?? '')));

  ipcMain.handle('get-system-prompt', () => buildSystemPrompt(getSettings()));

  ipcMain.handle('get-model-catalog', () => {
    const modelsDir = getModelsDir();
    const files = listModelFiles(modelsDir);
    const settings = getSettings();
    return {
      modelsDir,
      totalMemBytes: os.totalmem(),
      whisper: modelStatuses('whisper', WHISPER_MODELS, modelsDir, files, settings.whisperModel),
      llm: modelStatuses('llm', LLM_MODELS, modelsDir, files, settings.llmModel),
    };
  });

  ipcMain.handle('download-model', async (event, file: string) => {
    const model = findCatalogModel(file);
    if (!model) throw new Error(`Modelo desconocido: ${file}`);

    await downloadModel(model, getModelsDir(), progress => {
      if (!event.sender.isDestroyed()) event.sender.send('model-download-progress', progress);
    });
  });

  ipcMain.handle('activate-model', async (_event, kind: ModelKind, file: string) => {
    const name = path.basename(file);
    if (!fs.existsSync(path.join(getModelsDir(), name))) {
      throw new Error(`El modelo no está descargado: ${name}`);
    }
    const settings = updateSettings(kind === 'whisper' ? { whisperModel: name } : { llmModel: name });
    if (kind === 'llm') await aiManager.ensureLlama();
    return settings;
  });

  ipcMain.handle('set-record-shortcut', (_event, accelerator: string) => {
    if (!applyRecordShortcut(accelerator, toggleRecordingInEditor)) {
      return { ok: false, settings: getSettings() };
    }
    return { ok: true, settings: updateSettings({ recordShortcut: accelerator }) };
  });

  let audioChunks: Buffer[] = []

  ipcMain.on('audio-chunk', (_event, pcmData: Int16Array) => {
    const buf = Buffer.from(new Int16Array(pcmData).buffer);
    audioChunks.push(buf);
  });

  ipcMain.on('audio-stop', async (event) => {
    if (audioChunks.length === 0) return;
    console.log('Processing audio chunks...');
    
    // Copy chunks and clear global state for next recording immediately
    const chunksToProcess = [...audioChunks];
    audioChunks = [];
    
    let wavPath: string | null = null;
    try {
      wavPath = saveWavFile(chunksToProcess, app.getPath('temp'));
      if (!wavPath) return;
      
      console.log('Transcribing...');
      const transcription = await transcribeAudio(wavPath);
      event.sender.send('transcription-result', transcription);
      
      if (transcription) {
        console.log('Fixing grammar...');
        const corrected = await fixGrammar(transcription);
        event.sender.send('correction-result', corrected);
      }
    } catch (e) {
      console.error('AI Processing error:', e);
      event.sender.send('ai-error', e instanceof Error ? e.message : String(e));
    } finally {
      if (wavPath && fs.existsSync(wavPath)) {
        try {
          fs.unlinkSync(wavPath);
        } catch (unlinkErr) {
          console.error('Failed to delete temp wav file:', unlinkErr);
        }
      }
    }
  })
}
