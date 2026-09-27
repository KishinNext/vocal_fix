import { app, ipcMain } from 'electron'
import fs from 'fs'
import { aiManager } from '../ai'
import { saveWavFile } from '../audioService'

export function registerAudioHandlers() {
  let audioChunks: Buffer[] = []

  ipcMain.on('audio-chunk', (_event, pcmData: Int16Array) => {
    audioChunks.push(Buffer.from(new Int16Array(pcmData).buffer))
  })

  ipcMain.on('audio-stop', async (event) => {
    if (audioChunks.length === 0) return

    // Take the chunks and reset immediately so the next recording starts clean
    const chunksToProcess = audioChunks
    audioChunks = []

    let wavPath: string | null = null
    try {
      wavPath = saveWavFile(chunksToProcess, app.getPath('temp'))
      if (!wavPath) return

      const transcription = await aiManager.transcribeAudio(wavPath)
      event.sender.send('transcription-result', transcription)

      if (transcription) {
        const corrected = await aiManager.fixGrammar(transcription)
        event.sender.send('correction-result', corrected)
      }
    } catch (e) {
      console.error('AI Processing error:', e)
      event.sender.send('ai-error', e instanceof Error ? e.message : String(e))
    } finally {
      if (wavPath) fs.rmSync(wavPath, { force: true })
    }
  })

  // Re-corrects existing text (e.g. after switching tone in the editor) without re-recording
  ipcMain.handle('fix-grammar', (_event, text: string) => aiManager.fixGrammar(String(text ?? '')))
}
