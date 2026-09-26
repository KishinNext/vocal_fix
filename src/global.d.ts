export {};

declare global {
  interface Window {
    electronAPI: {
      openSettings: () => void;
      closeWindow: () => void;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      getModels: () => Promise<{ whisper: string[], llama: string[] }>;
      sendAudioChunk: (pcmData: Int16Array) => void;
      sendAudioStop: () => void;
      onTranscription: (callback: (text: string) => void) => () => void;
      onCorrection: (callback: (text: string) => void) => () => void;
      onAiError: (callback: (error: string) => void) => () => void;
      onMemoryStats: (callback: (memoryGB: string) => void) => () => void;
    };
    copyCurrentSuggestion: () => void;
  }
}
