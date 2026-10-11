import type { EngineStatus } from '../electron/engineStatus';
import type { PromptsResponse } from '../electron/prompt';
import type { AppSettings } from '../electron/settingsSchema';
import type { UpdateState } from '../electron/updateState';
import type { CatalogModel, ModelKind } from '../electron/modelCatalog';
import type { SegmentText } from '../electron/streamSession';

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
      getPrompts: () => Promise<PromptsResponse>;
      getEngineStatus: () => Promise<EngineStatus>;
      getUpdateState: () => Promise<UpdateState>;
      checkUpdates: () => Promise<UpdateState>;
      installUpdate: () => Promise<void>;
      onUpdateState: (callback: (state: UpdateState) => void) => () => void;
      onEngineStatus: (callback: (status: EngineStatus) => void) => () => void;
      rewriteNatural: (text: string) => Promise<string>;
      getModelCatalog: () => Promise<ModelCatalogResponse>;
      downloadModel: (file: string) => Promise<void>;
      activateModel: (kind: ModelKind, file: string) => Promise<AppSettings>;
      setRecordShortcut: (accelerator: string) => Promise<{ ok: boolean; settings: AppSettings }>;
      onModelDownloadProgress: (callback: (progress: DownloadProgressEvent) => void) => () => void;
      onToggleRecording: (callback: () => void) => () => void;
      sendAudioChunk: (pcmData: Int16Array) => void;
      sendAudioStop: () => void;
      onStreamPartial: (callback: (segment: SegmentText) => void) => () => void;
      onStreamFinal: (callback: (segment: SegmentText) => void) => () => void;
      onStreamGrammar: (callback: (segment: SegmentText) => void) => () => void;
      onStreamNatural: (callback: (segment: SegmentText) => void) => () => void;
      onAiError: (callback: (error: string) => void) => () => void;
    };
  }
}
