// Messages between the main process (ai.ts) and the LLM utility process (llmWorker.ts)

export type LlmRequest =
  | { id: number, type: 'load', modelPath: string }
  | { id: number, type: 'prompt', modelPath: string, systemPrompt: string, text: string, temperature: number }

export interface LlmResponse {
  id: number
  result?: string
  error?: string
}
