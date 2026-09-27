// Reads the natural expression aloud with the system's voices (Web Speech API, offline on macOS).

const SPANISH_HINTS = /[ñáéíóú¿¡]|\b(el|la|los|las|que|de|del|y|es|en|por|para|con|una?|pero|muy|está|estoy)\b/gi
const ENGLISH_HINTS = /\b(the|and|is|are|to|of|in|for|with|that|this|you|i|it|was|have)\b/gi

export function detectLanguage(text: string): 'es' | 'en' {
  const spanish = text.match(SPANISH_HINTS)?.length ?? 0
  const english = text.match(ENGLISH_HINTS)?.length ?? 0
  return spanish > english ? 'es' : 'en'
}

// Prefers an installed (offline) voice for the language
export function pickVoice(voices: SpeechSynthesisVoice[], lang: 'es' | 'en'): SpeechSynthesisVoice | null {
  const matching = voices.filter(voice => voice.lang.toLowerCase().startsWith(lang))
  return matching.find(voice => voice.localService) ?? matching[0] ?? null
}

export class Speaker {
  private current: { utterance: SpeechSynthesisUtterance, onEnd: () => void } | null = null

  constructor() {
    // Chromium loads the voice list lazily: request it early so the first read picks a voice
    speechSynthesis.getVoices()
  }

  get isSpeaking() {
    return this.current !== null
  }

  // onEnd runs once, when reading finishes, fails or is stopped
  speak(text: string, onEnd: () => void) {
    this.stop()
    const lang = detectLanguage(text)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'es' ? 'es-ES' : 'en-US'
    utterance.voice = pickVoice(speechSynthesis.getVoices(), lang)
    // Events of a cancelled utterance can arrive later: only the current one may finish
    const done = () => { if (this.current?.utterance === utterance) this.finish() }
    utterance.onend = done
    utterance.onerror = done
    this.current = { utterance, onEnd }
    speechSynthesis.speak(utterance)
  }

  stop() {
    this.finish()
    speechSynthesis.cancel()
  }

  private finish() {
    const current = this.current
    this.current = null
    current?.onEnd()
  }
}
