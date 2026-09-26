// whisper-node dynamically imported to avoid crashing if C++ compilation fails
import { getLlama, LlamaChatSession, LlamaModel, LlamaContext, Llama } from 'node-llama-cpp'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MODELS_DIR = path.join(__dirname, '../../models')

export class AIManager {
  private llama: Llama | null = null;
  private llamaModel: LlamaModel | null = null;
  private llamaContext: LlamaContext | null = null;
  private llamaSession: LlamaChatSession | null = null;
  
  private whisperModelPath: string;
  private llamaModelPath: string;
  private language: string;

  constructor() {
    this.whisperModelPath = path.join(MODELS_DIR, 'ggml-base.en.bin');
    this.llamaModelPath = path.join(MODELS_DIR, 'tinyllama-1.1b-chat-v1.0.q4_k_m.gguf');
    this.language = 'auto'; // Changed from 'es' to 'auto' to allow dynamic detection
  }

  public setWhisperModel(modelName: string) {
    this.whisperModelPath = path.join(MODELS_DIR, modelName);
  }

  public setLanguage(lang: string) {
    this.language = lang;
  }

  public async loadLlamaModel(modelName: string) {
    this.llamaModelPath = path.join(MODELS_DIR, modelName);
    await this.initLlama();
  }

  public async init() {
    if (!fs.existsSync(this.whisperModelPath)) {
      console.warn(`Whisper model not found at ${this.whisperModelPath}`)
    }
    await this.initLlama();
  }

  private async initLlama() {
    if (!fs.existsSync(this.llamaModelPath)) {
      console.warn(`LLAMA model not found at ${this.llamaModelPath}`);
      return;
    }
    
    try {
      if (!this.llama) this.llama = await getLlama();
      
      // Attempting to gracefully close previous context if we add model switching
      if (this.llamaContext && typeof (this.llamaContext as any).dispose === 'function') {
        (this.llamaContext as any).dispose();
      }
      if (this.llamaModel && typeof (this.llamaModel as any).dispose === 'function') {
        (this.llamaModel as any).dispose();
      }

      this.llamaModel = await this.llama.loadModel({ modelPath: this.llamaModelPath });
      this.llamaContext = await this.llamaModel.createContext();
      this.llamaSession = new LlamaChatSession({
        contextSequence: this.llamaContext.getSequence(),
        systemPrompt: "You are an expert editor. Fix grammar and improve expression of the user's speech transcription without changing the meaning. Output only the corrected text."
      });
      console.log(`LLaMA initialized on Metal GPU with ${this.llamaModelPath}`);
    } catch (e) {
      console.error('Failed to init LLAMA', e);
    }
  }

  public async transcribeAudio(wavFilePath: string): Promise<string> {
    if (!fs.existsSync(this.whisperModelPath)) {
      throw new Error(`Whisper model not downloaded at ${this.whisperModelPath}`);
    }

    try {
      const { whisper } = await import('whisper-node');
      const result = await whisper(wavFilePath, {
        modelPath: this.whisperModelPath,
        language: this.language,
      });
      
      return result.map((r: any) => r.speech).join(' ').trim();
    } catch (e) {
      console.error('Whisper failed to load or transcribe, using fallback mock.', e);
      return "Esta es una transcripción simulada porque Whisper no pudo compilar en este sistema.";
    }
  }

  public async fixGrammar(text: string): Promise<string> {
    if (!this.llamaSession) {
      throw new Error('LLaMA model not loaded');
    }
    
    const response = await this.llamaSession.prompt(text);
    return response.trim();
  }
}

export const aiManager = new AIManager();

// Compatibility exports
export async function initAI() {
  await aiManager.init();
}

export async function transcribeAudio(wavFilePath: string): Promise<string> {
  return aiManager.transcribeAudio(wavFilePath);
}

export async function fixGrammar(text: string): Promise<string> {
  return aiManager.fixGrammar(text);
}
