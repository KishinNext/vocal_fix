export type ModelKind = 'whisper' | 'llm'

export interface CatalogModel {
  kind: ModelKind
  name: string
  file: string
  url: string
  sizeBytes: number
  ramBytes: number // approximate RAM while loaded
  note: string
  englishOnly?: boolean
}

const WHISPER_BASE_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'

function whisper(
  name: string, file: string, sizeBytes: number, ramBytes: number, note: string, englishOnly = false,
): CatalogModel {
  return { kind: 'whisper', name, file, url: `${WHISPER_BASE_URL}/${file}`, sizeBytes, ramBytes, note, englishOnly }
}

const MB = 1_000_000
const GB = 1_000_000_000

// sizeBytes: Content-Length reported by Hugging Face (used for progress and display).
// Whisper ramBytes: memory figures published in the whisper.cpp README (turbo variants estimated).
export const WHISPER_MODELS: CatalogModel[] = [
  whisper('Whisper Tiny', 'ggml-tiny.bin', 77_691_713, 273 * MB, 'Transcripción casi instantánea con más errores. Útil en equipos modestos o para notas rápidas.'),
  whisper('Whisper Tiny', 'ggml-tiny.en.bin', 77_704_715, 273 * MB, 'Versión Tiny especializada en inglés: algo más precisa que la multilingüe en ese idioma.', true),
  whisper('Whisper Base', 'ggml-base.bin', 147_951_465, 388 * MB, 'Buen equilibrio entre velocidad y precisión para dictado diario en español e inglés.'),
  whisper('Whisper Base', 'ggml-base.en.bin', 147_964_211, 388 * MB, 'Versión Base especializada en inglés.', true),
  whisper('Whisper Small', 'ggml-small.bin', 487_601_967, 852 * MB, 'Precisión notablemente mejor con acentos y ruido. Recomendado si tu equipo lo permite.'),
  whisper('Whisper Small', 'ggml-small.en.bin', 487_614_201, 852 * MB, 'Versión Small especializada en inglés.', true),
  whisper('Whisper Large v3 Turbo Q5', 'ggml-large-v3-turbo-q5_0.bin', 574_041_195, 900 * MB, 'Large v3 Turbo cuantizado: calidad cercana a Large con el consumo de un Small.'),
  whisper('Whisper Medium', 'ggml-medium.bin', 1_533_763_059, 2.1 * GB, 'Alta precisión en vocabulario técnico y frases largas. Más lento.'),
  whisper('Whisper Medium', 'ggml-medium.en.bin', 1_533_774_781, 2.1 * GB, 'Versión Medium especializada en inglés.', true),
  whisper('Whisper Large v3 Turbo', 'ggml-large-v3-turbo.bin', 1_624_555_275, 1.8 * GB, 'Calidad de Large v3 con decodificación mucho más rápida.'),
  whisper('Whisper Large v3', 'ggml-large-v3.bin', 3_095_033_483, 3.9 * GB, 'Máxima precisión multilingüe. Requiere un equipo potente.'),
]

// LLM ramBytes: file size + fp16 KV cache for the 4096-token context set in ai.ts + ~250 MB of compute buffers.
export const LLM_MODELS: CatalogModel[] = [
  {
    kind: 'llm',
    name: 'Qwen2.5 0.5B',
    file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    sizeBytes: 491_400_032,
    ramBytes: 0.8 * GB,
    note: 'El más ligero. Corrige ortografía y puntuación básicas en varios idiomas; flojo en reescrituras.',
  },
  {
    kind: 'llm',
    name: 'TinyLlama 1.1B',
    file: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    sizeBytes: 668_788_096,
    ramBytes: 1.0 * GB,
    note: 'Muy ligero y rápido, pero su calidad en español es limitada.',
  },
  {
    kind: 'llm',
    name: 'Llama 3.2 1B',
    file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    sizeBytes: 807_694_464,
    ramBytes: 1.2 * GB,
    note: 'Ligero y rápido, multilingüe. Correcciones correctas en frases sencillas.',
  },
  {
    kind: 'llm',
    name: 'SmolLM2 1.7B',
    file: 'smollm2-1.7b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf',
    sizeBytes: 1_055_609_536,
    ramBytes: 2.1 * GB,
    note: 'Ligero y competente, pero entrenado casi solo en inglés.',
    englishOnly: true,
  },
  {
    kind: 'llm',
    name: 'Qwen2.5 1.5B',
    file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeBytes: 1_117_320_736,
    ramBytes: 1.5 * GB,
    note: 'La mejor relación calidad/tamaño en español. Recomendado para la mayoría de equipos.',
  },
  {
    kind: 'llm',
    name: 'Llama 3.2 3B',
    file: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    sizeBytes: 2_019_377_696,
    ramBytes: 2.8 * GB,
    note: 'Mayor fluidez y naturalidad al reescribir. Multilingüe.',
  },
  {
    kind: 'llm',
    name: 'Phi-3 Mini 4K',
    file: 'Phi-3-mini-4k-instruct-q4.gguf',
    url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
    sizeBytes: 2_393_231_072,
    ramBytes: 4.2 * GB,
    note: 'Muy preciso en gramática, orientado a inglés. El que más memoria usa.',
    englishOnly: true,
  },
]

// Three picks per engine (fast, balanced, best quality) sized for the machine's RAM
const ROOMY_RAM_BYTES = 12 * 2 ** 30

export function recommendedModels(kind: ModelKind, totalMemBytes: number): string[] {
  if (kind === 'llm') {
    return ['qwen2.5-0.5b-instruct-q4_k_m.gguf', 'qwen2.5-1.5b-instruct-q4_k_m.gguf', 'Llama-3.2-3B-Instruct-Q4_K_M.gguf']
  }
  return totalMemBytes >= ROOMY_RAM_BYTES
    ? ['ggml-small.bin', 'ggml-large-v3-turbo-q5_0.bin', 'ggml-large-v3.bin']
    : ['ggml-base.bin', 'ggml-small.bin', 'ggml-large-v3-turbo-q5_0.bin']
}

export function findCatalogModel(file: string): CatalogModel | undefined {
  return [...WHISPER_MODELS, ...LLM_MODELS].find(m => m.file === file)
}

// Short label for compact UI such as the editor's header dropdowns ("Base (EN)", "Qwen2.5 0.5B").
// Files not in the catalog fall back to their name without extension.
export function modelDisplayName(file: string): string {
  const model = findCatalogModel(file)
  if (!model) return file.replace(/\.(bin|gguf)$/i, '')
  const name = model.name.replace(/^Whisper /, '')
  return model.kind === 'whisper' && model.englishOnly ? `${name} (EN)` : name
}

// Classifies arbitrary files found in the models folder (same rule the editor dropdowns use).
export function isWhisperFile(file: string): boolean {
  return file.endsWith('.bin') && (file.includes('ggml') || file.includes('whisper'))
}

export function isLlmFile(file: string): boolean {
  return file.endsWith('.gguf') && !file.includes('whisper')
}
