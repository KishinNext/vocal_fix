import { SpeechSegmenter, type SegmentEvent } from './speechSegmenter'

// One recording: cuts the audio into utterances and pushes each one through
// partial transcription -> final transcription -> grammar review -> natural expression.

export interface SegmentText {
  id: string    // unique across recordings
  text: string
}

export type StreamChannel = 'stream-partial' | 'stream-final' | 'stream-grammar' | 'stream-natural'

export interface StreamDeps {
  transcribe: (pcm: Int16Array, prompt: string) => Promise<string>
  correctGrammar: (text: string) => Promise<string>
  rewriteNatural: (text: string) => Promise<string>
  send: (channel: StreamChannel, payload: SegmentText) => void
  onError: (message: string) => void
}

// Previous sentence handed to whisper as context
const CONTEXT_CHARS = 200

let sessionCount = 0

export class StreamSession {
  private readonly segmenter = new SpeechSegmenter()
  private readonly session = ++sessionCount
  private finals: SegmentEvent[] = []
  private partial: SegmentEvent | null = null  // only the latest one is worth transcribing
  private lastFinalSegment = 0
  private pumping: Promise<void> | null = null
  private reviews: Promise<void> = Promise.resolve()
  private context = ''
  private failed = false
  private readonly deps: StreamDeps

  constructor(deps: StreamDeps) {
    this.deps = deps
  }

  push(pcm: Int16Array) {
    this.enqueue(this.segmenter.push(pcm))
  }

  stop() {
    this.enqueue(this.segmenter.flush())
  }

  // Resolves once every queued utterance has been transcribed and reviewed
  async idle() {
    while (this.pumping) await this.pumping
    await this.reviews
  }

  private id(segment: number) {
    return `${this.session}-${segment}`
  }

  private enqueue(events: SegmentEvent[]) {
    if (this.failed) return
    for (const event of events) {
      if (event.type === 'final') {
        this.finals.push(event)
        this.lastFinalSegment = event.segment
      } else {
        this.partial = event
      }
    }
    this.pumping ??= this.pump().finally(() => { this.pumping = null })
  }

  // Whisper work runs one request at a time; confirmed utterances go first and
  // partials that fell behind are skipped, so the queue never grows while speaking.
  private async pump() {
    try {
      while (!this.failed) {
        const final = this.finals.shift()
        if (final) {
          await this.transcribeFinal(final)
          continue
        }
        const partial = this.partial
        this.partial = null
        if (!partial) break
        if (partial.segment > this.lastFinalSegment) await this.transcribePartial(partial)
      }
    } catch (e) {
      this.fail(e)
    }
  }

  private async transcribePartial(event: SegmentEvent) {
    const text = await this.deps.transcribe(event.audio, this.context)
    // The utterance may have been confirmed while this partial was running
    if (event.segment > this.lastFinalSegment && text) {
      this.deps.send('stream-partial', { id: this.id(event.segment), text })
    }
  }

  private async transcribeFinal(event: SegmentEvent) {
    const id = this.id(event.segment)
    const text = event.audio.length > 0 ? await this.deps.transcribe(event.audio, this.context) : ''
    this.deps.send('stream-final', { id, text })
    if (!text) return

    this.context = text.slice(-CONTEXT_CHARS)
    this.reviews = this.reviews.then(() => this.review(id, text))
  }

  private async review(id: string, text: string) {
    if (this.failed) return
    try {
      const corrected = await this.deps.correctGrammar(text)
      this.deps.send('stream-grammar', { id, text: corrected })
      this.deps.send('stream-natural', { id, text: await this.deps.rewriteNatural(corrected) })
    } catch (e) {
      this.fail(e)
    }
  }

  // A missing model or binary fails every request: report it once and stop
  private fail(e: unknown) {
    if (this.failed) return
    this.failed = true
    this.deps.onError(e instanceof Error ? e.message : String(e))
  }
}
