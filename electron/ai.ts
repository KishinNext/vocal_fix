// Grammar review and natural expression. The model runs in a utility process
// (llmWorker.ts) so loading it never blocks this process; speech-to-text lives in whisperServer.ts.
import { utilityProcess, type UtilityProcess } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { LlmRequest, LlmResponse } from './llmProtocol'
import { buildGrammarPrompt, buildSystemPrompt } from './prompt'
import { getModelsDir, getSettings } from './settingsStore'

// Bundled next to main.js by vite-plugin-electron
const WORKER_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'llmWorker.js')
// The grammar review is a diff of what was said: keep it near-deterministic
const GRAMMAR_TEMPERATURE = 0.1

type Request = LlmRequest extends infer R ? R extends unknown ? Omit<R, 'id'> : never : never

class AIManager {
  private worker: UtilityProcess | null = null
  private nextId = 0
  private readonly pending = new Map<number, { resolve: (text: string) => void, reject: (e: Error) => void }>()

  // Loads (or switches to) the LLM selected in settings
  async ensureLlama(): Promise<void> {
    await this.request({ type: 'load', modelPath: this.modelPath() })
  }

  correctGrammar(text: string): Promise<string> {
    return this.prompt(text, buildGrammarPrompt(getSettings()), GRAMMAR_TEMPERATURE)
  }

  rewriteNatural(text: string): Promise<string> {
    const settings = getSettings()
    return this.prompt(text, buildSystemPrompt(settings), settings.temperature)
  }

  stop() {
    this.worker?.kill()
    this.worker = null
  }

  private prompt(text: string, systemPrompt: string, temperature: number) {
    return this.request({ type: 'prompt', modelPath: this.modelPath(), systemPrompt, text, temperature })
  }

  private modelPath() {
    return path.join(getModelsDir(), getSettings().llmModel)
  }

  private request(request: Request): Promise<string> {
    if (!fs.existsSync(request.modelPath)) {
      return Promise.reject(new Error(`Modelo de lenguaje no descargado: ${path.basename(request.modelPath)}`))
    }
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.spawn().postMessage({ ...request, id } as LlmRequest)
    })
  }

  private spawn(): UtilityProcess {
    if (this.worker) return this.worker
    const worker = utilityProcess.fork(WORKER_PATH, [], { serviceName: 'VocalFix LLM', stdio: 'inherit' })
    worker.on('message', ({ id, result, error }: LlmResponse) => {
      const request = this.pending.get(id)
      this.pending.delete(id)
      if (error !== undefined) request?.reject(new Error(error))
      else request?.resolve(result ?? '')
    })
    worker.on('exit', code => {
      if (this.worker === worker) this.worker = null
      // A crash (e.g. out of memory) fails what was in flight; the next request restarts it
      for (const request of this.pending.values()) request.reject(new Error(`El proceso del LLM terminó (código ${code})`))
      this.pending.clear()
    })
    this.worker = worker
    return worker
  }
}

export const aiManager = new AIManager()
