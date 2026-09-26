import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openSettings: () => ipcRenderer.send('open-settings'),
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  getModels: () => ipcRenderer.invoke('get-models'),
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
  },
  onMemoryStats: (callback: (memoryGB: string) => void) => {
    const listener = (_event: any, value: string) => callback(value);
    ipcRenderer.on('memory-stats', listener);
    return () => ipcRenderer.removeListener('memory-stats', listener);
  }
})
