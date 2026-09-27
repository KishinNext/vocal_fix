// whisper-node dynamically imported to avoid crashing if C++ compilation fails
import { getLlama, LlamaChatSession, LlamaModel, LlamaContext, Llama } from 'node-llama-cpp'
import path from 'path'
import fs from 'fs'
import { getModelsDir, getSettings } from './settingsStore'
import { buildSystemPrompt } from './prompt'

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

    try {
      const { whisper } = await import('whisper-node');
      const result = await whisper(wavFilePath, {
        modelPath: whisperModelPath,
        // whisper-node only forwards flags nested in whisperOptions (-l <language>)
        whisperOptions: { language },
      });

      return result.map((r: any) => r.speech).join(' ').trim();
    } catch (e) {
      console.error('Whisper failed to load or transcribe, using fallback mock.', e);
      return "Esta es una transcripción simulada porque Whisper no pudo compilar en este sistema.";
    }
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

// Compatibility exports
export async function initAI() {
  try {
    await aiManager.init();
  } catch (e) {
    console.error('Failed to init AI', e);
  }
}

export async function transcribeAudio(wavFilePath: string): Promise<string> {
  return aiManager.transcribeAudio(wavFilePath);
}

export async function fixGrammar(text: string): Promise<string> {
  return aiManager.fixGrammar(text);
}
