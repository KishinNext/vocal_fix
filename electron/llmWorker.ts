// Runs node-llama-cpp in an Electron utility process. getLlama() blocks its thread for
// ~20s the first time (native backend + Metal setup); in the main process that froze IPC,
// so streamed audio piled up and dictation only appeared after stopping.
import type { Llama, LlamaChatSession, LlamaContext, LlamaModel } from 'node-llama-cpp'
import type { LlmRequest, LlmResponse } from './llmProtocol'

const LLM_CONTEXT_SIZE = 4096
// Replies are about as long as the dictated sentence: stops a model that starts rambling
const MAX_REPLY_TOKENS = 400

let llama: Llama | null = null
let model: LlamaModel | null = null
let context: LlamaContext | null = null
let session: LlamaChatSession | null = null
let loadedPath: string | null = null

async function ensureModel(modelPath: string): Promise<LlamaChatSession> {
  if (session && modelPath === loadedPath) return session

  session = null
  loadedPath = null
  await context?.dispose()
  await model?.dispose()
  context = null
  model = null

  const { getLlama, LlamaChatSession } = await import('node-llama-cpp')
  llama ??= await getLlama()
  model = await llama.loadModel({ modelPath })
  // Fixed size keeps RAM predictable (the catalog's RAM estimates assume it); prompts are short.
  context = await model.createContext({ contextSize: LLM_CONTEXT_SIZE })
  session = new LlamaChatSession({ contextSequence: context.getSequence() })
  loadedPath = modelPath
  console.log(`LLaMA initialized (${llama.gpu || 'cpu'}) with ${modelPath}`)
  return session
}

async function handle(request: LlmRequest): Promise<string> {
  const chat = await ensureModel(request.modelPath)
  if (request.type === 'load') return ''
  // Each prompt is independent: reset history so the context never fills up
  // and prompt/rule changes from Settings apply immediately.
  chat.setChatHistory([
    { type: 'system', text: request.systemPrompt },
    ...request.examples.flatMap(({ transcript, reply }) => [
      { type: 'user' as const, text: transcript },
      { type: 'model' as const, response: [reply] },
    ]),
  ])
  const reply = await chat.prompt(request.text, { temperature: request.temperature, maxTokens: MAX_REPLY_TOKENS })
  return reply.trim()
}

// One chat session is shared, so requests run one at a time, in arrival order
let queue: Promise<unknown> = Promise.resolve()

process.parentPort.on('message', ({ data }: { data: LlmRequest }) => {
  queue = queue.then(async () => {
    let response: LlmResponse
    try {
      response = { id: data.id, result: await handle(data) }
    } catch (e) {
      response = { id: data.id, error: e instanceof Error ? e.message : String(e) }
    }
    process.parentPort.postMessage(response)
  })
})
