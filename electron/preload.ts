import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

// Main -> renderer events; each subscription returns its unsubscribe function
function subscribe(channel: string) {
  return (callback: (value: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, value: unknown) => callback(value)
    ipcRenderer.on(channel, listener)
    return () => { ipcRenderer.removeListener(channel, listener) }
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  getModels: () => ipcRenderer.invoke('get-models'),
  selectModelsPath: () => ipcRenderer.invoke('select-models-path'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (patch: unknown) => ipcRenderer.invoke('update-settings', patch),
  getSystemPrompt: () => ipcRenderer.invoke('get-system-prompt'),
  rewriteNatural: (text: string) => ipcRenderer.invoke('rewrite-natural', text),
  getModelCatalog: () => ipcRenderer.invoke('get-model-catalog'),
  downloadModel: (file: string) => ipcRenderer.invoke('download-model', file),
  activateModel: (kind: string, file: string) => ipcRenderer.invoke('activate-model', kind, file),
  setRecordShortcut: (accelerator: string) => ipcRenderer.invoke('set-record-shortcut', accelerator),
  onModelDownloadProgress: subscribe('model-download-progress'),
  onToggleRecording: subscribe('toggle-recording'),
  sendAudioChunk: (pcmData: Int16Array) => ipcRenderer.send('audio-chunk', pcmData),
  sendAudioStop: () => ipcRenderer.send('audio-stop'),
  onStreamPartial: subscribe('stream-partial'),
  onStreamFinal: subscribe('stream-final'),
  onStreamGrammar: subscribe('stream-grammar'),
  onStreamNatural: subscribe('stream-natural'),
  onAiError: subscribe('ai-error'),
})
