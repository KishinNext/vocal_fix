// Both native libraries are imported lazily: node-llama-cpp takes ~3s to import and
// would delay app startup; whisper-node runs side effects on import (see WHISPER_CPP_BINARY).
import type { LlamaChatSession, LlamaModel, LlamaContext, Llama } from 'node-llama-cpp'
import path from 'path'
import fs from 'fs'
import { getModelsDir, getSettings } from './settingsStore'
import { buildSystemPrompt } from './prompt'
import { createRequire } from 'module'

const WHISPER_CPP_BINARY = path.join(
  path.dirname(createRequire(import.meta.url).resolve('whisper-node')), '../lib/whisper.cpp/main',
);

const LLM_CONTEXT_SIZE = 4096;

export class AIManager {
  private llama: Llama | null = null;
  private llamaModel: LlamaModel | null = null;
  private llamaContext: LlamaContext | null = null;
  private llamaSession: LlamaChatSession | null = null;
  private loadedLlamaPath: string | null = null;
  private loading: Promise<void> | null = null;

  public async init() {
    const whisperPath = path.join(getModelsDir(), getSettings().whisperModel);
    if (!fs.existsSync(whisperPath)) {
      console.warn(`Whisper model not found at ${whisperPath}`)
    }
    await this.ensureLlama();
  }

  // Loads the LLM selected in settings if it differs from the loaded one.
  // Serialized so a model switch during a correction never loads twice.
  public async ensureLlama(): Promise<void> {
    while (this.loading) await this.loading;

    const modelPath = path.join(getModelsDir(), getSettings().llmModel);
    if (modelPath === this.loadedLlamaPath && this.llamaSession) return;

    this.loading = this.loadLlama(modelPath).finally(() => { this.loading = null; });
    await this.loading;
  }

  private async loadLlama(modelPath: string) {
    await this.disposeLlama();

    if (!fs.existsSync(modelPath)) {
      console.warn(`LLAMA model not found at ${modelPath}`);
      return;
    }

    const { getLlama, LlamaChatSession } = await import('node-llama-cpp');
    if (!this.llama) this.llama = await getLlama();
    this.llamaModel = await this.llama.loadModel({ modelPath });
    // Fixed size keeps RAM predictable (the catalog's RAM estimates assume it); corrections are short.
    this.llamaContext = await this.llamaModel.createContext({ contextSize: LLM_CONTEXT_SIZE });
    this.llamaSession = new LlamaChatSession({ contextSequence: this.llamaContext.getSequence() });
    this.loadedLlamaPath = modelPath;
    console.log(`LLaMA initialized (${this.llama.gpu || 'cpu'}) with ${modelPath}`);
  }

  private async disposeLlama() {
    this.llamaSession = null;
    this.loadedLlamaPath = null;
    await this.llamaContext?.dispose();
    await this.llamaModel?.dispose();
    this.llamaContext = null;
    this.llamaModel = null;
  }

  public async transcribeAudio(wavFilePath: string): Promise<string> {
    const { whisperModel, language } = getSettings();
    const whisperModelPath = path.join(getModelsDir(), whisperModel);
    if (!fs.existsSync(whisperModelPath)) {
      throw new Error(`Whisper model not downloaded at ${whisperModelPath}`);
    }

    // Importing whisper-node without its binary runs `make` synchronously on the main
    // thread (freezing the app) and calls process.exit(1) if that fails, so check first.
    if (!fs.existsSync(WHISPER_CPP_BINARY)) {
      throw new Error(
        'whisper.cpp no está compilado. Ejecuta `make main` en node_modules/whisper-node/lib/whisper.cpp',
      );
    }

    const { whisper } = await import('whisper-node');
    const result = await whisper(wavFilePath, {
      modelPath: whisperModelPath,
      // whisper-node only forwards flags nested in whisperOptions (-l <language>)
      whisperOptions: { language },
    });
    // whisper-node logs and swallows whisper.cpp failures, returning undefined
    if (!result) throw new Error('Whisper no pudo transcribir el audio');

    return result.map(r => r.speech).join(' ').trim();
  }

  public async fixGrammar(text: string): Promise<string> {
    await this.ensureLlama();
    if (!this.llamaSession) {
      throw new Error(`LLM model not downloaded: ${getSettings().llmModel}`);
    }

    // Each correction is independent: reset history so the context never fills up
    // and prompt/rule changes from Settings apply immediately.
    const settings = getSettings();
    this.llamaSession.setChatHistory([{ type: 'system', text: buildSystemPrompt(settings) }]);
    const response = await this.llamaSession.prompt(text, { temperature: settings.temperature });
    return response.trim();
  }
}

export const aiManager = new AIManager();
