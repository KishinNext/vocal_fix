// Whisper annotates non-speech as [BLANK_AUDIO], [MUSIC], (silence), *sighs*, ♪...
// Dictation never needs those, so they are dropped before reaching the UI or the LLM.
const NON_SPEECH = /\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|[♪♫♬♩]/g

// What whisper tends to "hear" in silence or background noise (it was trained on
// subtitled videos). Dropped only when it is the whole utterance: said inside a
// sentence, "thank you" is kept.
const SILENCE_HALLUCINATIONS = new Set([
  'you', 'thank you', 'thank you very much', 'thanks for watching', 'thank you for watching',
  'bubbles', 'gracias por ver el video', 'subtitles by the amaraorg community',
  'subtítulos realizados por la comunidad de amaraorg',
])

const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim()

export function cleanTranscript(text: string): string {
  const cleaned = text.replace(NON_SPEECH, ' ').replace(/\s+/g, ' ').trim()
  return SILENCE_HALLUCINATIONS.has(normalize(cleaned)) ? '' : cleaned
}
