import { SAMPLE_RATE } from './wav'

// Energy-based voice activity detection that cuts continuous microphone audio into
// utterances: while someone speaks it periodically asks for a partial transcription.
// A short pause only reports the utterance so far ("pause"): whoever transcribes it can
// end it there if it reads as a finished sentence (endIfSettled). Otherwise it stays
// open, so a hesitation in the middle of a sentence does not split it, and a long
// pause closes it.

const FRAME_MS = 20
const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / 1000

export interface SegmenterOptions {
  silenceMs: number      // pause after which the utterance so far is reported
  maxPauseMs: number     // pause that always ends an utterance
  maxSegmentMs: number   // forced cut for long monologues (whisper handles 30s windows)
  partialStepMs: number  // how often the in-progress utterance is re-transcribed
  minSpeechMs: number    // shorter bursts (clicks, taps) are discarded
  preRollMs: number      // audio kept from before the speech started, so onsets aren't clipped
}

export const DEFAULT_SEGMENTER_OPTIONS: SegmenterOptions = {
  silenceMs: 700,
  maxPauseMs: 2000,
  maxSegmentMs: 15000,
  partialStepMs: 800,
  minSpeechMs: 200,
  preRollMs: 200,
}

// Speech must be louder than this (RMS in [0, 1]) and clearly above the room's noise floor
const MIN_SPEECH_RMS = 0.01
const NOISE_FLOOR_RATIO = 2.5
const NOISE_FLOOR_ADAPT = 0.05
// Silence kept inside an utterance when the speaker goes on after a pause, and at its
// end. Whisper loses or garbles the words that follow a long silence and invents text
// for a long silent tail, so the rest is cut out.
const KEPT_SILENCE_MS = 300

export interface SegmentEvent {
  type: 'partial' | 'pause' | 'final'
  segment: number  // increases with every utterance
  audio: Int16Array
  settled?: boolean  // final only: nothing was said since the last "pause" event
}

function rms(frame: Int16Array): number {
  let sum = 0
  for (const sample of frame) sum += (sample / 32768) ** 2
  return Math.sqrt(sum / frame.length)
}

function concat(frames: Int16Array[]): Int16Array {
  const out = new Int16Array(frames.reduce((n, f) => n + f.length, 0))
  let offset = 0
  for (const frame of frames) {
    out.set(frame, offset)
    offset += frame.length
  }
  return out
}

export class SpeechSegmenter {
  private readonly options: SegmenterOptions
  private remainder = new Int16Array(0)
  private noiseFloor = MIN_SPEECH_RMS / NOISE_FLOOR_RATIO
  private preRoll: Int16Array[] = []
  private frames: Int16Array[] = []  // current utterance; empty while idle
  private speechMs = 0
  private silenceMs = 0
  private sincePartialMs = 0
  private segment = 0
  private paused = false  // a "pause" was reported and no speech has followed

  constructor(options: Partial<SegmenterOptions> = {}) {
    this.options = { ...DEFAULT_SEGMENTER_OPTIONS, ...options }
  }

  push(pcm: Int16Array): SegmentEvent[] {
    const samples = concat([this.remainder, pcm])
    const events: SegmentEvent[] = []
    let offset = 0
    for (; offset + FRAME_SAMPLES <= samples.length; offset += FRAME_SAMPLES) {
      const event = this.processFrame(samples.slice(offset, offset + FRAME_SAMPLES))
      if (event) events.push(event)
    }
    this.remainder = samples.slice(offset)
    return events
  }

  // Ends the utterance now if it is still in the pause that was reported for it
  endIfSettled(segment: number): SegmentEvent[] {
    if (!this.paused || segment !== this.segment) return []
    const event = this.close()
    return event ? [event] : []
  }

  // Ends the current utterance (recording stopped)
  flush(): SegmentEvent[] {
    const event = this.close()
    this.remainder = new Int16Array(0)
    return event ? [event] : []
  }

  private processFrame(frame: Int16Array): SegmentEvent | null {
    const level = rms(frame)
    const isSpeech = level > Math.max(MIN_SPEECH_RMS, this.noiseFloor * NOISE_FLOOR_RATIO)
    const { silenceMs, maxPauseMs, maxSegmentMs, partialStepMs, minSpeechMs, preRollMs } = this.options

    if (this.frames.length === 0) {
      if (!isSpeech) {
        this.noiseFloor += (level - this.noiseFloor) * NOISE_FLOOR_ADAPT
        this.preRoll.push(frame)
        if (this.preRoll.length * FRAME_MS > preRollMs) this.preRoll.shift()
        return null
      }
      this.segment++
      this.frames = [...this.preRoll, frame]
      this.preRoll = []
      this.speechMs = FRAME_MS
      this.silenceMs = 0
      this.sincePartialMs = 0
      this.paused = false
      return null
    }

    if (isSpeech && this.silenceMs > KEPT_SILENCE_MS) {
      const excess = (this.silenceMs - KEPT_SILENCE_MS) / FRAME_MS
      this.frames.splice(this.frames.length - excess, excess)
    }
    this.frames.push(frame)
    if (isSpeech) {
      this.speechMs += FRAME_MS
      this.silenceMs = 0
      this.paused = false
    } else {
      this.silenceMs += FRAME_MS
    }

    if (this.silenceMs >= maxPauseMs || this.frames.length * FRAME_MS >= maxSegmentMs) {
      return this.close()
    }
    if (!this.paused && this.silenceMs >= silenceMs) {
      // A click or tap is not worth keeping open
      if (this.speechMs < minSpeechMs) return this.close()
      this.paused = true
      this.sincePartialMs = 0
      return { type: 'pause', segment: this.segment, audio: this.audio(this.frames) }
    }

    // Nothing new to transcribe while the speaker is silent
    if (this.paused) return null
    this.sincePartialMs += FRAME_MS
    if (this.sincePartialMs >= partialStepMs) {
      this.sincePartialMs = 0
      return { type: 'partial', segment: this.segment, audio: concat(this.frames) }
    }
    return null
  }

  // The utterance without its silent tail
  private audio(frames: Int16Array[]): Int16Array {
    const excess = Math.max(0, (this.silenceMs - KEPT_SILENCE_MS) / FRAME_MS)
    return concat(frames.slice(0, frames.length - excess))
  }

  private close(): SegmentEvent | null {
    const frames = this.frames
    const hadSpeech = this.speechMs >= this.options.minSpeechMs
    const settled = this.paused
    this.frames = []
    this.speechMs = 0
    this.paused = false
    if (frames.length === 0) return null
    // A discarded burst still emits an empty final so a partial already shown gets removed
    return { type: 'final', segment: this.segment, audio: hadSpeech ? this.audio(frames) : new Int16Array(0), settled }
  }
}
