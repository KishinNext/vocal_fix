import { SAMPLE_RATE } from './wav'

// Energy-based voice activity detection that cuts continuous microphone audio into
// utterances: while someone speaks it periodically asks for a partial transcription,
// and a pause closes the utterance so it can be confirmed and corrected.

const FRAME_MS = 20
const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / 1000

export interface SegmenterOptions {
  silenceMs: number      // pause that ends an utterance
  maxSegmentMs: number   // forced cut for long monologues (whisper handles 30s windows)
  partialStepMs: number  // how often the in-progress utterance is re-transcribed
  minSpeechMs: number    // shorter bursts (clicks, taps) are discarded
  preRollMs: number      // audio kept from before the speech started, so onsets aren't clipped
}

export const DEFAULT_SEGMENTER_OPTIONS: SegmenterOptions = {
  silenceMs: 700,
  maxSegmentMs: 15000,
  partialStepMs: 800,
  minSpeechMs: 200,
  preRollMs: 200,
}

// Speech must be louder than this (RMS in [0, 1]) and clearly above the room's noise floor
const MIN_SPEECH_RMS = 0.01
const NOISE_FLOOR_RATIO = 2.5
const NOISE_FLOOR_ADAPT = 0.05

export interface SegmentEvent {
  type: 'partial' | 'final'
  segment: number  // increases with every utterance
  audio: Int16Array
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

  // Ends the current utterance (recording stopped)
  flush(): SegmentEvent[] {
    const event = this.close()
    this.remainder = new Int16Array(0)
    return event ? [event] : []
  }

  private processFrame(frame: Int16Array): SegmentEvent | null {
    const level = rms(frame)
    const isSpeech = level > Math.max(MIN_SPEECH_RMS, this.noiseFloor * NOISE_FLOOR_RATIO)
    const { silenceMs, maxSegmentMs, partialStepMs, preRollMs } = this.options

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
      return null
    }

    this.frames.push(frame)
    if (isSpeech) {
      this.speechMs += FRAME_MS
      this.silenceMs = 0
    } else {
      this.silenceMs += FRAME_MS
    }

    if (this.silenceMs >= silenceMs || this.frames.length * FRAME_MS >= maxSegmentMs) {
      return this.close()
    }

    this.sincePartialMs += FRAME_MS
    if (this.sincePartialMs >= partialStepMs) {
      this.sincePartialMs = 0
      return { type: 'partial', segment: this.segment, audio: concat(this.frames) }
    }
    return null
  }

  private close(): SegmentEvent | null {
    const frames = this.frames
    const hadSpeech = this.speechMs >= this.options.minSpeechMs
    this.frames = []
    this.speechMs = 0
    if (frames.length === 0) return null
    // A discarded burst still emits an empty final so a partial already shown gets removed
    return { type: 'final', segment: this.segment, audio: hadSpeech ? concat(frames) : new Int16Array(0) }
  }
}
