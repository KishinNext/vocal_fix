/**
 * VocalFix – Streaming dictation tests: VAD segmentation, stream pipeline,
 * transcript cleanup, WAV encoding, word diff and the three editor panels.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SpeechSegmenter, type SegmentEvent } from '../electron/speechSegmenter'
import { StreamSession, type StreamChannel, type SegmentText } from '../electron/streamSession'
import { cleanTranscript } from '../electron/transcript'
import { SAMPLE_RATE, encodeWav } from '../electron/wav'
import { diffWords } from '../src/word-diff'
import { TranscriptView } from '../src/transcript-view'

const samples = (ms: number) => (SAMPLE_RATE * ms) / 1000

function silence(ms: number) {
  return new Int16Array(samples(ms))
}

// A 220 Hz tone at ~30% volume stands in for speech
function speech(ms: number) {
  const pcm = new Int16Array(samples(ms))
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE) * 10000)
  return pcm
}

const ofType = (events: SegmentEvent[], type: SegmentEvent['type']) => events.filter(e => e.type === type)

describe('SpeechSegmenter', () => {
  it('stays quiet during silence', () => {
    expect(new SpeechSegmenter().push(silence(3000))).toEqual([])
  })

  it('closes an utterance after the configured pause', () => {
    const segmenter = new SpeechSegmenter({ silenceMs: 700 })
    expect(ofType(segmenter.push(concat(silence(500), speech(600), silence(600))), 'final')).toEqual([])

    const [final] = segmenter.push(silence(200))
    expect(final.type).toBe('final')
    expect(final.segment).toBe(1)
    // pre-roll + speech + the pause that closed it
    expect(final.audio.length).toBe(samples(200 + 600 + 700))
  })

  it('emits partials while the speaker keeps talking', () => {
    const events = new SpeechSegmenter({ partialStepMs: 800 }).push(speech(2500))
    const partials = ofType(events, 'partial')
    expect(partials).toHaveLength(3)
    // each partial holds the whole utterance so far
    expect(partials[1].audio.length).toBeGreaterThan(partials[0].audio.length)
  })

  it('cuts long monologues', () => {
    const finals = ofType(new SpeechSegmenter({ maxSegmentMs: 2000 }).push(speech(5000)), 'final')
    expect(finals.map(f => f.segment)).toEqual([1, 2])
  })

  it('numbers utterances in order', () => {
    const segmenter = new SpeechSegmenter()
    const finals = ofType(segmenter.push(concat(speech(400), silence(800), speech(400), silence(800))), 'final')
    expect(finals.map(f => f.segment)).toEqual([1, 2])
  })

  it('discards clicks shorter than the minimum speech', () => {
    const [final] = new SpeechSegmenter({ minSpeechMs: 200 }).push(concat(speech(40), silence(800)))
    expect(final).toEqual({ type: 'final', segment: 1, audio: new Int16Array(0) })
  })

  it('handles chunks that do not align with frames', () => {
    const segmenter = new SpeechSegmenter()
    const audio = concat(speech(500), silence(800))
    const events: SegmentEvent[] = []
    for (let i = 0; i < audio.length; i += 1000) events.push(...segmenter.push(audio.slice(i, i + 1000)))
    expect(ofType(events, 'final')).toHaveLength(1)
  })

  it('flushes the utterance in progress when recording stops', () => {
    const segmenter = new SpeechSegmenter()
    segmenter.push(speech(500))
    expect(segmenter.flush().map(e => e.type)).toEqual(['final'])
    expect(segmenter.flush()).toEqual([])
  })
})

function concat(...parts: Int16Array[]) {
  const out = new Int16Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

describe('StreamSession', () => {
  function createSession(overrides: Partial<ConstructorParameters<typeof StreamSession>[0]> = {}) {
    const sent: [StreamChannel, SegmentText][] = []
    const deps = {
      transcribe: vi.fn(async (pcm: Int16Array) => `said ${pcm.length}`),
      correctGrammar: vi.fn(async (text: string) => `grammar(${text})`),
      rewriteNatural: vi.fn(async (text: string) => `natural(${text})`),
      send: (channel: StreamChannel, payload: SegmentText) => { sent.push([channel, payload]) },
      onError: vi.fn(),
      ...overrides,
    }
    return { session: new StreamSession(deps), deps, sent }
  }

  it('runs each utterance through transcription, grammar and natural expression', async () => {
    const { session, sent } = createSession()
    session.push(concat(speech(400), silence(800)))
    await session.idle()

    const id = sent[0][1].id
    expect(sent.map(([channel]) => channel)).toEqual(['stream-final', 'stream-grammar', 'stream-natural'])
    expect(sent.every(([, payload]) => payload.id === id)).toBe(true)
    expect(sent[2][1].text).toBe(`natural(grammar(${sent[0][1].text}))`)
  })

  it('shows partials while speaking and confirms on stop', async () => {
    const { session, sent } = createSession()
    session.push(speech(1000))
    await session.idle()
    expect(sent.map(([channel]) => channel)).toEqual(['stream-partial'])

    session.stop()
    await session.idle()
    expect(sent.map(([channel]) => channel)).toContain('stream-final')
  })

  it('gives whisper the previous sentence as context', async () => {
    const transcribe = vi.fn(async (pcm: Int16Array, _prompt: string) => `said ${pcm.length}`)
    const { session } = createSession({ transcribe })
    session.push(concat(speech(400), silence(800)))
    await session.idle()
    session.push(concat(speech(400), silence(800)))
    await session.idle()
    const [first, second] = transcribe.mock.calls
    expect(first[1]).toBe('')
    expect(second[1]).toBe('said ' + first[0].length)
  })

  it('skips partials that fell behind a confirmed utterance', async () => {
    let release!: () => void
    const transcribe = vi.fn()
      .mockImplementationOnce(() => new Promise<string>(r => { release = () => r('partial') }))
      .mockResolvedValue('final text')
    const { session, sent } = createSession({ transcribe })
    session.push(speech(900))            // partial starts transcribing
    session.push(concat(speech(900), silence(800))) // more partials + the final arrive meanwhile
    release()
    await session.idle()
    expect(sent.filter(([channel]) => channel === 'stream-partial')).toEqual([])
    expect(transcribe).toHaveBeenCalledTimes(2) // the stale partial, then the final only
  })

  it('does not review empty or discarded utterances', async () => {
    const { session, sent, deps } = createSession({ transcribe: vi.fn().mockResolvedValue('') })
    session.push(concat(speech(400), silence(800)))
    await session.idle()
    expect(sent).toEqual([['stream-final', { id: expect.any(String), text: '' }]])
    expect(deps.correctGrammar).not.toHaveBeenCalled()
  })

  it('reports the first failure once and stops', async () => {
    const onError = vi.fn()
    const { session } = createSession({ transcribe: vi.fn().mockRejectedValue(new Error('whisper.cpp no está compilado')), onError })
    session.push(concat(speech(400), silence(800), speech(400), silence(800)))
    await session.idle()
    session.push(concat(speech(400), silence(800)))
    await session.idle()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith('whisper.cpp no está compilado')
  })

  it('uses ids that stay unique across recordings', async () => {
    const a = createSession()
    const b = createSession()
    a.session.push(concat(speech(400), silence(800)))
    b.session.push(concat(speech(400), silence(800)))
    await Promise.all([a.session.idle(), b.session.idle()])
    expect(a.sent[0][1].id).not.toBe(b.sent[0][1].id)
  })
})

describe('cleanTranscript()', () => {
  it.each([
    ['[BLANK_AUDIO]', ''],
    [' Thank you. [BLANK_AUDIO]\n', 'Thank you.'],
    ['(silence) hola [MUSIC] mundo *sighs*', 'hola mundo'],
    ['  Hello,\n  world.  ', 'Hello, world.'],
  ])('%j -> %j', (input, expected) => {
    expect(cleanTranscript(input)).toBe(expected)
  })
})

describe('encodeWav()', () => {
  it('writes a 16 kHz mono 16-bit header followed by the samples', () => {
    const wav = encodeWav(new Int16Array([1, -1, 300]))
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
    expect(wav.readUInt16LE(22)).toBe(1)
    expect(wav.readUInt32LE(24)).toBe(16000)
    expect(wav.readUInt16LE(34)).toBe(16)
    expect(wav.readUInt32LE(40)).toBe(6)
    expect(wav.readInt16LE(44 + 4)).toBe(300)
  })
})

describe('diffWords()', () => {
  it('marks replaced and removed words', () => {
    expect(diffWords('I go to the office', 'I went to the office')).toEqual([
      { type: 'same', text: 'I' },
      { type: 'del', text: 'go' },
      { type: 'add', text: 'went' },
      { type: 'same', text: 'to the office' },
    ])
    expect(diffWords('we discuss about the policy', 'we discussed the policy')).toEqual([
      { type: 'same', text: 'we' },
      { type: 'del', text: 'discuss about' },
      { type: 'add', text: 'discussed' },
      { type: 'same', text: 'the policy' },
    ])
  })

  it('treats casing and punctuation fixes as unchanged, keeping the corrected form', () => {
    expect(diffWords('yesterday i left', 'Yesterday, I left.')).toEqual([{ type: 'same', text: 'Yesterday, I left.' }])
  })

  it('handles empty input', () => {
    expect(diffWords('', 'Hola')).toEqual([{ type: 'add', text: 'Hola' }])
    expect(diffWords('hola', '')).toEqual([{ type: 'del', text: 'hola' }])
  })
})

describe('TranscriptView', () => {
  let panels: { transcription: HTMLElement, review: HTMLElement, natural: HTMLElement }

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="t"><span>Esperando voz...</span></div>
      <div id="r"><span>Esperando voz...</span></div>
      <div id="n"><span>Esperando voz...</span></div>`
    panels = {
      transcription: document.getElementById('t')!,
      review: document.getElementById('r')!,
      natural: document.getElementById('n')!,
    }
  })

  const texts = (el: HTMLElement) => [...el.querySelectorAll('p')].map(p => p.textContent)

  it('replaces the placeholder and updates a partial until it is confirmed', () => {
    const view = new TranscriptView(panels)
    view.partial('1-1', 'yesterday I')
    view.partial('1-1', 'yesterday I go')
    expect(texts(panels.transcription)).toEqual(['yesterday I go'])
    expect(panels.transcription.textContent).not.toContain('Esperando')

    view.final('1-1', 'yesterday I go to the office')
    view.partial('1-1', 'late partial')
    expect(texts(panels.transcription)).toEqual(['yesterday I go to the office'])
    expect(texts(panels.review)).toEqual(['…'])
    expect(texts(panels.natural)).toEqual(['…'])
  })

  it('stacks utterances from the top in every panel', () => {
    const view = new TranscriptView(panels)
    view.final('1-1', 'one')
    view.final('1-2', 'two')
    view.grammar('1-2', 'Two.')
    view.grammar('1-1', 'One.')
    expect(texts(panels.transcription)).toEqual(['one', 'two'])
    expect(texts(panels.review)).toEqual(['One.', 'Two.'])
  })

  it('renders the grammar review as a word diff', () => {
    const view = new TranscriptView(panels)
    view.final('1-1', 'the client say that')
    view.grammar('1-1', 'The client said that')
    const review = panels.review.querySelector('p')!
    expect(review.querySelector('.line-through')?.textContent).toBe('say')
    expect(review.querySelector('.text-emerald-400')?.textContent).toBe('said')
    expect(review.textContent).toBe('The client say said that')
  })

  it('removes an utterance that turned out to be silence', () => {
    const view = new TranscriptView(panels)
    view.partial('1-1', 'noise')
    view.final('1-1', '')
    expect(texts(panels.transcription)).toEqual([])
    expect(texts(panels.review)).toEqual([])
  })

  it('joins the natural expressions for copying', () => {
    const view = new TranscriptView(panels)
    view.final('1-1', 'a')
    view.final('1-2', 'b')
    view.natural('1-1', 'First.')
    view.natural('1-2', 'Second.')
    expect(view.naturalText()).toBe('First. Second.')
  })

  it('rewrites every confirmed utterance from its grammar-corrected text', async () => {
    const view = new TranscriptView(panels)
    view.final('1-1', 'a')
    view.grammar('1-1', 'A.')
    view.final('1-2', 'b')
    const rewrite = vi.fn(async (text: string) => `pro ${text}`)
    await view.rewriteAll(rewrite)
    expect(rewrite.mock.calls).toEqual([['A.'], ['b']])
    expect(texts(panels.natural)).toEqual(['pro A.', 'pro b'])
  })

  it('ignores a rewrite superseded by a newer one', async () => {
    const view = new TranscriptView(panels)
    view.final('1-1', 'a')
    let release!: (v: string) => void
    const first = view.rewriteAll(() => new Promise<string>(r => { release = r }))
    await view.rewriteAll(async () => 'second')
    release('first')
    await first
    expect(texts(panels.natural)).toEqual(['second'])
  })

  it('restores the previous suggestions when the rewrite fails', async () => {
    const view = new TranscriptView(panels)
    view.final('1-1', 'a')
    view.natural('1-1', 'Natural.')
    await expect(view.rewriteAll(() => Promise.reject(new Error('LLM')))).rejects.toThrow('LLM')
    expect(texts(panels.natural)).toEqual(['Natural.'])
  })

  it('renders errors as text, never as markup', () => {
    const view = new TranscriptView(panels)
    view.error('<img src=x onerror="alert(1)">')
    expect(panels.transcription.querySelector('img')).toBeNull()
    expect(panels.transcription.textContent).toContain('<img')
  })
})
