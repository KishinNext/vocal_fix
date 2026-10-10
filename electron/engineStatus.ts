import fs from 'fs'

// Whether each model is loading, ready or unusable, so the editor can show it.

export type Engine = 'whisper' | 'llm'
export type EngineState = 'loading' | 'ready' | 'missing' | 'error'

export interface EngineInfo {
  state: EngineState
  message: string  // why it is missing or failed
}

export type EngineStatus = Record<Engine, EngineInfo>

// Both models start loading as soon as the editor opens
const status: EngineStatus = {
  whisper: { state: 'loading', message: '' },
  llm: { state: 'loading', message: '' },
}
const listeners = new Set<(status: EngineStatus) => void>()

export function getEngineStatus(): EngineStatus {
  return status
}

export function onEngineStatus(listener: (status: EngineStatus) => void) {
  listeners.add(listener)
}

export function setEngineState(engine: Engine, state: EngineState, message = '') {
  status[engine] = { state, message }
  for (const listener of listeners) listener(status)
}

// Runs a model load, keeping the engine's status in step with it
export async function trackLoad<T>(engine: Engine, modelPath: string, load: () => Promise<T>): Promise<T> {
  setEngineState(engine, 'loading')
  try {
    const result = await load()
    setEngineState(engine, 'ready')
    return result
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    setEngineState(engine, fs.existsSync(modelPath) ? 'error' : 'missing', message)
    throw e
  }
}
