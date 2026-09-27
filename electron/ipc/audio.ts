import { ipcMain, type WebContents } from 'electron'
import { aiManager } from '../ai'
import { StreamSession } from '../streamSession'
import { whisperServer } from '../whisperServer'

function createSession(sender: WebContents) {
  const send = (channel: string, payload: unknown) => {
    if (!sender.isDestroyed()) sender.send(channel, payload)
  }
  return new StreamSession({
    transcribe: (pcm, prompt) => whisperServer.transcribe(pcm, prompt),
    correctGrammar: text => aiManager.correctGrammar(text),
    rewriteNatural: text => aiManager.rewriteNatural(text),
    send,
    onError: message => send('ai-error', message),
  })
}

export function registerAudioHandlers() {
  // Audio streams in while recording; a stopped session keeps working through its
  // queue while the next recording starts a new one.
  let session: StreamSession | null = null

  ipcMain.on('audio-chunk', (event, pcm: Int16Array) => {
    session ??= createSession(event.sender)
    session.push(new Int16Array(pcm))
  })

  ipcMain.on('audio-stop', () => {
    session?.stop()
    session = null
  })

  // Re-writes confirmed text after switching tone in the editor, without re-recording
  ipcMain.handle('rewrite-natural', (_event, text: string) => aiManager.rewriteNatural(String(text ?? '')))
}
