import type { AppSettings } from '../electron/settingsSchema';
import type { CatalogModel, ModelKind } from '../electron/modelCatalog';

export interface ModelStatus extends CatalogModel {
  custom: boolean;
  downloaded: boolean;
  active: boolean;
  progress: { received: number; total: number } | null;
}

export interface ModelCatalogResponse {
  modelsDir: string;
  totalMemBytes: number;
  whisper: ModelStatus[];
  llm: ModelStatus[];
}

export interface DownloadProgressEvent {
  file: string;
  received: number;
  total: number;
}

declare global {
  interface Window {
    electronAPI: {
      getModels: () => Promise<{ whisper: string[], llama: string[] }>;
      selectModelsPath: () => Promise<string | null>;
      getSettings: () => Promise<AppSettings>;
      updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      getSystemPrompt: () => Promise<string>;
      fixGrammar: (text: string) => Promise<string>;
      getModelCatalog: () => Promise<ModelCatalogResponse>;
      downloadModel: (file: string) => Promise<void>;
      activateModel: (kind: ModelKind, file: string) => Promise<AppSettings>;
      setRecordShortcut: (accelerator: string) => Promise<{ ok: boolean; settings: AppSettings }>;
      onModelDownloadProgress: (callback: (progress: DownloadProgressEvent) => void) => () => void;
      onToggleRecording: (callback: () => void) => () => void;
      sendAudioChunk: (pcmData: Int16Array) => void;
      sendAudioStop: () => void;
      onTranscription: (callback: (text: string) => void) => () => void;
      onCorrection: (callback: (text: string) => void) => () => void;
      onAiError: (callback: (error: string) => void) => () => void;
    };
    copyCurrentSuggestion: () => void;
  }
}
