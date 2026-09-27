import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openSettings: () => ipcRenderer.send('open-settings'),
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  getModels: () => ipcRenderer.invoke('get-models'),
  getModelsPath: () => ipcRenderer.invoke('get-models-path'),
  selectModelsPath: () => ipcRenderer.invoke('select-models-path'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (patch: unknown) => ipcRenderer.invoke('update-settings', patch),
  getSystemPrompt: () => ipcRenderer.invoke('get-system-prompt'),
  fixGrammar: (text: string) => ipcRenderer.invoke('fix-grammar', text),
  getModelCatalog: () => ipcRenderer.invoke('get-model-catalog'),
  downloadModel: (file: string) => ipcRenderer.invoke('download-model', file),
  activateModel: (kind: string, file: string) => ipcRenderer.invoke('activate-model', kind, file),
  setRecordShortcut: (accelerator: string) => ipcRenderer.invoke('set-record-shortcut', accelerator),
  onModelDownloadProgress: (callback: (progress: { file: string, received: number, total: number }) => void) => {
    const listener = (_event: any, value: { file: string, received: number, total: number }) => callback(value);
    ipcRenderer.on('model-download-progress', listener);
    return () => ipcRenderer.removeListener('model-download-progress', listener);
  },
  onToggleRecording: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('toggle-recording', listener);
    return () => ipcRenderer.removeListener('toggle-recording', listener);
  },
  sendAudioChunk: (pcmData: Int16Array) => ipcRenderer.send('audio-chunk', pcmData),
  sendAudioStop: () => ipcRenderer.send('audio-stop'),
  onTranscription: (callback: (text: string) => void) => {
    const listener = (_event: any, value: string) => callback(value);
    ipcRenderer.on('transcription-result', listener);
    return () => ipcRenderer.removeListener('transcription-result', listener);
  },
  onCorrection: (callback: (text: string) => void) => {
    const listener = (_event: any, value: string) => callback(value);
    ipcRenderer.on('correction-result', listener);
    return () => ipcRenderer.removeListener('correction-result', listener);
  },
  onAiError: (callback: (error: string) => void) => {
    const listener = (_event: any, value: string) => callback(value);
    ipcRenderer.on('ai-error', listener);
    return () => ipcRenderer.removeListener('ai-error', listener);
  }
})
