import type { AppSettings, Intervention, Profile } from './settingsSchema'

const BASE_INSTRUCTION =
  'You are an expert editor of speech transcriptions. ' +
  'Answer in the same language as the input. ' +
  'Output only the corrected text, without explanations, quotes or notes.'

const INTERVENTION_INSTRUCTIONS: Record<Intervention, string> = {
  minimal: 'Only fix spelling, punctuation and clear grammatical errors. Do not rephrase or change word choice.',
  balanced: 'Fix grammar and punctuation, and improve awkward phrasing for clarity, without changing the meaning.',
  creative: 'Rewrite freely for fluency and natural style while preserving the original meaning.',
}

const PROFILE_INSTRUCTIONS: Record<Profile, string> = {
  conversational: 'Keep an informal, natural spoken tone.',
  academic: 'Use a formal, precise academic register and precise vocabulary.',
  business: 'Use a clear, concise professional tone suitable for business email.',
  concise: 'Make the text as short as possible: remove redundancy and wordiness while keeping every key point.',
  'es-en':
    'The speaker is a native Spanish speaker writing in English. ' +
    "Correct Spanish-influenced structures and false friends (e.g. 'I have 26 years' -> 'I am 26 years old', " +
    "'actually' used to mean 'currently', 'sensible' used to mean 'sensitive').",
}

export function buildSystemPrompt(settings: AppSettings): string {
  const lines = [
    BASE_INSTRUCTION,
    INTERVENTION_INSTRUCTIONS[settings.intervention],
    PROFILE_INSTRUCTIONS[settings.profile],
  ]

  if (settings.rules.removeFillers) {
    lines.push("Remove filler words and hesitations (e.g. 'eh', 'um', 'este', 'o sea', 'like', 'you know').")
  }
  if (settings.rules.normalizeContractions) {
    lines.push("Expand colloquial contractions (e.g. 'gonna' -> 'going to', 'wanna' -> 'want to', 'pa'' -> 'para').")
  }
  if (settings.glossary.length > 0) {
    lines.push(`Keep these terms exactly as written: ${settings.glossary.join(', ')}.`)
  }

  return lines.join('\n')
}
