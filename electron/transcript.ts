// Whisper annotates non-speech as [BLANK_AUDIO], [MUSIC], (silence), *sighs*...
// Dictation never needs those, so they are dropped before reaching the UI or the LLM.
const NON_SPEECH = /\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g

export function cleanTranscript(text: string): string {
  return text.replace(NON_SPEECH, ' ').replace(/\s+/g, ' ').trim()
}
