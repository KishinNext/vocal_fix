// Decides whether a transcript reads as a finished sentence, so a pause in the middle
// of one ("I would like ... work") does not split it in two.

const TERMINAL = /[.?!]["'”’)\]]*$/
const TRAILING_OFF = /(\.\.\.|…)["'”’)\]]*$/

// Words that rarely end a sentence: whisper often puts a period after them anyway
const DANGLING = new Set([
  // English
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'because', 'if', 'that', 'which', 'who', 'to', 'of', 'in', 'on',
  'at', 'for', 'with', 'from', 'by', 'about', 'as', 'than', 'into', 'like', 'is', 'are', 'was', 'were', 'am',
  'be', 'been', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must',
  'i', 'we', 'they', 'my', 'your', 'his', 'our', 'their', 'this', 'these', 'those', 'not', 'very',
  // Spanish
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'porque', 'que', 'si', 'de', 'del',
  'en', 'al', 'con', 'por', 'para', 'sobre', 'como', 'es', 'son', 'está', 'están', 'he', 'ha', 'han', 'muy',
  'mi', 'tu', 'su',
])

export function endsSentence(text: string): boolean {
  const trimmed = text.trim()
  if (!TERMINAL.test(trimmed) || TRAILING_OFF.test(trimmed)) return false
  const lastWord = trimmed.toLowerCase().match(/[\p{L}\p{N}']+(?=[^\p{L}\p{N}]*$)/u)?.[0] ?? ''
  return !DANGLING.has(lastWord)
}
