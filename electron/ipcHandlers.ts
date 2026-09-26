import { app, BrowserWindow, ipcMain } from 'electron'
import { createSettingsWindow } from './windows'
import { saveWavFile } from './audioService'
import { transcribeAudio, fixGrammar } from './ai'
import fs from 'fs'

export function registerIpcHandlers(preload: string, settingsHtml: string) {
  ipcMain.on('open-settings', () => {
    console.log('[IPC] open-settings received — creating settings window')
    createSettingsWindow(preload, settingsHtml)
  })

  ipcMain.handle('get-models', async () => {
    try {
      const modelsDir = require('path').join(__dirname, '../../models');
      if (!fs.existsSync(modelsDir)) return { whisper: [], llama: [] };
      
      const files = fs.readdirSync(modelsDir);
      const whisper = files.filter((f: string) => f.includes('ggml') || f.includes('whisper'));
      const llama = files.filter((f: string) => f.endsWith('.gguf') && !f.includes('whisper'));
      
      return { whisper, llama };
    } catch (e) {
      console.error('Failed to read models dir', e);
      return { whisper: [], llama: [] };
    }
  });

  ipcMain.on('close-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) window.close()
  })

  ipcMain.on('minimize-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) window.minimize()
  })

  ipcMain.on('maximize-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
  })

  let audioChunks: Buffer[] = []

  ipcMain.on('audio-chunk', (event, pcmData: Int16Array) => {
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
