// Cheap guess between the two languages the app is used with.

const SPANISH_HINTS = /[ñáéíóú¿¡]|\b(el|la|los|las|que|de|del|y|es|en|por|para|con|una?|pero|muy|está|estoy)\b/gi
const ENGLISH_HINTS = /\b(the|and|is|are|to|of|in|for|with|that|this|you|i|it|was|have)\b/gi

export function detectLanguage(text: string): 'es' | 'en' {
  const spanish = text.match(SPANISH_HINTS)?.length ?? 0
  const english = text.match(ENGLISH_HINTS)?.length ?? 0
  return spanish > english ? 'es' : 'en'
}
