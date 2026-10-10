// Pure settings schema (no Electron imports) so it can be unit-tested and shared.

export type Language = 'es' | 'en' | 'auto'
export type Intervention = 'minimal' | 'balanced' | 'creative'
export type Profile = 'conversational' | 'academic' | 'business' | 'concise' | 'es-en'

export interface GrammarRules {
  removeFillers: boolean
  normalizeContractions: boolean
}

// Instructions written by the user; '' uses the built-in ones (see prompt.ts)
export interface CustomPrompts {
  grammar: string
  natural: string
}

export interface AppSettings {
  modelsPath?: string
  whisperModel: string
  llmModel: string
  language: Language
  intervention: Intervention
  temperature: number
  profile: Profile
  rules: GrammarRules
  glossary: string[]
  prompts: CustomPrompts
  recordShortcut: string // Electron accelerator; '' disables it
}

export const LANGUAGES: Language[] = ['es', 'en', 'auto']
export const INTERVENTIONS: Intervention[] = ['minimal', 'balanced', 'creative']
export const PROFILES: Profile[] = ['conversational', 'academic', 'business', 'concise', 'es-en']

export const DEFAULT_TEMPERATURE: Record<Intervention, number> = {
  minimal: 0.1,
  balanced: 0.3,
  creative: 0.7,
}

export const DEFAULT_SETTINGS: AppSettings = {
  whisperModel: 'ggml-base.bin',
  llmModel: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
  language: 'auto',
  intervention: 'balanced',
  temperature: DEFAULT_TEMPERATURE.balanced,
  profile: 'conversational',
  rules: { removeFillers: true, normalizeContractions: false },
  glossary: [],
  prompts: { grammar: '', natural: '' },
  recordShortcut: 'CommandOrControl+Shift+Space',
}

const MAX_GLOSSARY_TERMS = 100
const MAX_TERM_LENGTH = 60
const MAX_PROMPT_LENGTH = 4000

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

// Merges untrusted input (settings file or renderer patch) over a base, dropping invalid values.
export function sanitizeSettings(input: unknown, base: AppSettings = DEFAULT_SETTINGS): AppSettings {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>
  const rules = (raw.rules && typeof raw.rules === 'object' ? raw.rules : {}) as Record<string, unknown>

  const prompts = (raw.prompts && typeof raw.prompts === 'object' ? raw.prompts : {}) as Record<string, unknown>
  const prompt = (key: keyof CustomPrompts) =>
    typeof prompts[key] === 'string' ? prompts[key].trim().slice(0, MAX_PROMPT_LENGTH) : base.prompts[key]

  const temperature = Number(raw.temperature)
  const glossary = Array.isArray(raw.glossary)
    ? [...new Set(
        raw.glossary
          .filter((t: unknown): t is string => typeof t === 'string')
          .map((t: string) => t.trim().slice(0, MAX_TERM_LENGTH))
          .filter(Boolean),
      )].slice(0, MAX_GLOSSARY_TERMS)
    : base.glossary

  return {
    modelsPath: typeof raw.modelsPath === 'string' && raw.modelsPath ? raw.modelsPath : base.modelsPath,
    whisperModel: typeof raw.whisperModel === 'string' && raw.whisperModel ? raw.whisperModel : base.whisperModel,
    llmModel: typeof raw.llmModel === 'string' && raw.llmModel ? raw.llmModel : base.llmModel,
    language: pick(raw.language, LANGUAGES, base.language),
    intervention: pick(raw.intervention, INTERVENTIONS, base.intervention),
    temperature: Number.isFinite(temperature) && raw.temperature !== null && raw.temperature !== ''
      ? Math.min(1, Math.max(0, Math.round(temperature * 100) / 100))
      : base.temperature,
    profile: pick(raw.profile, PROFILES, base.profile),
    rules: {
      removeFillers: typeof rules.removeFillers === 'boolean' ? rules.removeFillers : base.rules.removeFillers,
      normalizeContractions: typeof rules.normalizeContractions === 'boolean'
        ? rules.normalizeContractions
        : base.rules.normalizeContractions,
    },
    glossary,
    prompts: { grammar: prompt('grammar'), natural: prompt('natural') },
    recordShortcut: typeof raw.recordShortcut === 'string' ? raw.recordShortcut : base.recordShortcut,
  }
}
