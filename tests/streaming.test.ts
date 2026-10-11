/**
 * VocalFix – Streaming dictation tests: VAD segmentation, stream pipeline,
 * transcript cleanup, WAV encoding, word diff and the three editor panels.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SpeechSegmenter, type SegmentEvent } from '../electron/speechSegmenter'
import { StreamSession, type StreamChannel, type SegmentText } from '../electron/streamSession'
import { endsSentence } from '../electron/sentenceEnd'
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

  it('reports the utterance so far after a short pause, without closing it', () => {
    // Arrange
    const segmenter = new SpeechSegmenter({ silenceMs: 700 })
    segmenter.push(concat(silence(500), speech(600), silence(600)))

    // Act
    const events = segmenter.push(silence(200))

    // Assert
    expect(events.map(e => e.type)).toEqual(['pause'])
    // pre-roll + speech + a short silent tail
    expect(events[0].audio.length).toBe(samples(200 + 600 + 300))
  })

  it('closes an utterance after a long pause', () => {
    // Arrange
    const segmenter = new SpeechSegmenter({ silenceMs: 700, maxPauseMs: 2000 })
    segmenter.push(concat(silence(500), speech(600), silence(1900)))

    // Act
    const [final] = segmenter.push(silence(200))

    // Assert
    expect(final).toMatchObject({ type: 'final', segment: 1, settled: true })
    expect(final.audio.length).toBe(samples(200 + 600 + 300))
  })

  it('keeps the utterance open when speech resumes after a short pause', () => {
    // Arrange
    const segmenter = new SpeechSegmenter()

    // Act
    const events = segmenter.push(concat(speech(600), silence(900), speech(600), silence(2100)))

    // Assert
    expect(ofType(events, 'final').map(f => f.segment)).toEqual([1])
    expect(ofType(events, 'pause')).toHaveLength(2)
  })

  it('cuts a long pause inside an utterance down to a short gap', () => {
    // Arrange
    const segmenter = new SpeechSegmenter()

    // Act
    const events = segmenter.push(concat(speech(600), silence(1500), speech(600)))
    const [final] = segmenter.flush()

    // Assert
    expect(ofType(events, 'final')).toEqual([])
    expect(final.audio.length).toBe(samples(600 + 300 + 600))
  })

  it('ends a paused utterance on request, and only while it is still paused', () => {
    // Arrange
    const segmenter = new SpeechSegmenter()
    segmenter.push(concat(speech(600), silence(800)))

    // Act
    const ended = segmenter.endIfSettled(1)
    const again = segmenter.endIfSettled(1)

    // Assert
    expect(ended.map(e => [e.type, e.settled])).toEqual([['final', true]])
    expect(again).toEqual([])
  })

  it('does not end an utterance whose speaker is talking again', () => {
    // Arrange
    const segmenter = new SpeechSegmenter()
    segmenter.push(concat(speech(600), silence(800), speech(200)))

    // Act
    const ended = segmenter.endIfSettled(1)

    // Assert
    expect(ended).toEqual([])
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
    const finals = ofType(segmenter.push(concat(speech(400), silence(2100), speech(400), silence(2100))), 'final')
    expect(finals.map(f => f.segment)).toEqual([1, 2])
  })

  it('discards clicks shorter than the minimum speech', () => {
    const [final] = new SpeechSegmenter({ minSpeechMs: 200 }).push(concat(speech(40), silence(800)))
    expect(final).toEqual({ type: 'final', segment: 1, audio: new Int16Array(0), settled: false })
  })

  it('handles chunks that do not align with frames', () => {
    const segmenter = new SpeechSegmenter()
    const audio = concat(speech(500), silence(2100))
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
      transcribe: vi.fn(async (pcm: Int16Array) => `Said ${pcm.length}.`),
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
    const transcribe = vi.fn(async (pcm: Int16Array, _prompt: string) => `Said ${pcm.length}.`)
    const { session } = createSession({ transcribe })
    session.push(concat(speech(400), silence(800)))
    await session.idle()
    session.push(concat(speech(400), silence(800)))
    await session.idle()
    const [first, second] = transcribe.mock.calls
    expect(first[1]).toBe('')
    expect(second[1]).toBe(`Said ${first[0].length}.`)
  })

  it('skips the partials queued behind a finished sentence', async () => {
    let release!: () => void
    const transcribe = vi.fn()
      .mockImplementationOnce(() => new Promise<string>(r => { release = () => r('partial') }))
      .mockResolvedValue('Final text.')
    const { session, sent } = createSession({ transcribe })
    session.push(speech(900))            // partial starts transcribing
    session.push(concat(speech(900), silence(800))) // more partials + the pause arrive meanwhile
    release()
    await session.idle()
    expect(sent.filter(([channel]) => channel === 'stream-final').map(([, p]) => p.text)).toEqual(['Final text.'])
    expect(transcribe).toHaveBeenCalledTimes(2) // the stale partial, then the finished sentence
  })

  describe('pauses in the middle of a sentence', () => {
    it('keeps one utterance when the speaker hesitates and goes on', async () => {
      // Arrange
      const transcribe = vi.fn()
        .mockResolvedValueOnce('I would like')
        .mockResolvedValue('I would like work.')
      const { session, sent } = createSession({ transcribe })
      session.push(concat(speech(600), silence(800)))
      await session.idle()

      // Act
      session.push(concat(speech(400), silence(800)))
      await session.idle()

      // Assert
      const finals = sent.filter(([channel]) => channel === 'stream-final')
      expect(finals.map(([, payload]) => payload.text)).toEqual(['I would like work.'])
      expect(sent[0]).toEqual(['stream-partial', { id: finals[0][1].id, text: 'I would like' }])
    })

    it('confirms an unfinished sentence after a long pause without transcribing it again', async () => {
      // Arrange
      const transcribe = vi.fn().mockResolvedValue('I would like')
      const { session, sent } = createSession({ transcribe })

      // Act
      session.push(concat(speech(600), silence(2100)))
      await session.idle()

      // Assert
      expect(transcribe).toHaveBeenCalledTimes(1)
      expect(sent.filter(([channel]) => channel === 'stream-final').map(([, p]) => p.text)).toEqual(['I would like'])
    })

    it('transcribes again when more was said after the pause', async () => {
      // Arrange
      const transcribe = vi.fn()
        .mockResolvedValueOnce('I would like')
        .mockResolvedValue('I would like to')
      const { session, sent } = createSession({ transcribe })

      // Act
      session.push(concat(speech(600), silence(800), speech(300)))
      session.stop()
      await session.idle()

      // Assert
      expect(sent.filter(([channel]) => channel === 'stream-final').map(([, p]) => p.text)).toEqual(['I would like to'])
    })
  })

  describe('when transcription is slower than the partial step', () => {
    // Each transcription advances the fake clock by `tookMs`
    function createTimedSession(tookMs: number) {
      const clock = { ms: 0 }
      const transcribe = vi.fn(async (pcm: Int16Array) => {
        clock.ms += tookMs
        return `said ${pcm.length}`
      })
      return { ...createSession({ transcribe, now: () => clock.ms }), transcribe, clock }
    }

    it('drops the partials that arrive while whisper rests', async () => {
      // Arrange
      const { session, transcribe, clock } = createTimedSession(1500)
      session.push(speech(1000))
      await session.idle()
      clock.ms += 800

      // Act
      session.push(speech(800))
      await session.idle()

      // Assert
      expect(transcribe).toHaveBeenCalledTimes(1)
    })

    it('transcribes partials again once the rest is over', async () => {
      // Arrange
      const { session, transcribe, clock } = createTimedSession(1500)
      session.push(speech(1000))
      await session.idle()
      clock.ms += 1500

      // Act
      session.push(speech(800))
      await session.idle()

      // Assert
      expect(transcribe).toHaveBeenCalledTimes(2)
    })

    it('transcribes a confirmed utterance without waiting for the rest', async () => {
      // Arrange
      const { session, sent } = createTimedSession(1500)
      session.push(speech(1000))
      await session.idle()

      // Act
      session.stop()
      await session.idle()

      // Assert
      expect(sent.map(([channel]) => channel)).toContain('stream-final')
    })

    it('does not rest after a fast transcription', async () => {
      // Arrange
      const { session, transcribe } = createTimedSession(500)
      session.push(speech(1000))
      await session.idle()

      // Act
      session.push(speech(800))
      await session.idle()

      // Assert
      expect(transcribe).toHaveBeenCalledTimes(2)
    })
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
    [' Hello there. [BLANK_AUDIO]\n', 'Hello there.'],
    ['(silence) hola [MUSIC] mundo *sighs*', 'hola mundo'],
    ['  Hello,\n  world.  ', 'Hello, world.'],
    ['♪ ♪', ''],
    ['♪ la la ♪', 'la la'],
    // whisper's usual "silence" hallucinations, only when they are the whole utterance
    [' Thank you.', ''],
    ['Bubbles.', ''],
    ['Thanks for watching!', ''],
    ['I bought something. Thank you.', 'I bought something. Thank you.'],
    ['Thank you, Maria.', 'Thank you, Maria.'],
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
    expect(review.querySelector('span:not(.line-through)')?.textContent).toBe('said')
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

  it('clears every panel back to its placeholder and keeps working', () => {
    const onChange = vi.fn()
    const view = new TranscriptView(panels, onChange)
    view.final('1-1', 'a')
    view.grammar('1-1', 'A.')
    view.natural('1-1', 'Natural.')
    onChange.mockClear()

    view.clear()
    expect(onChange).toHaveBeenCalled()
    expect(view.naturalText()).toBe('')
    for (const panel of Object.values(panels)) expect(panel.textContent).toBe('Esperando voz...')

    view.final('1-2', 'b')
    expect(texts(panels.transcription)).toEqual(['b'])
    expect(panels.transcription.textContent).not.toContain('Esperando')
  })

  it('drops rewrite results that arrive after clearing', async () => {
    const view = new TranscriptView(panels)
    view.final('1-1', 'a')
    let release!: (v: string) => void
    const rewrite = view.rewriteAll(() => new Promise<string>(r => { release = r }))
    view.clear()
    release('late')
    await rewrite
    expect(panels.natural.textContent).toBe('Esperando voz...')
  })

  it('notifies when the suggested text changes', () => {
    const onChange = vi.fn()
    const view = new TranscriptView(panels, onChange)
    view.final('1-1', 'a')
    view.natural('1-1', 'A.')
    expect(onChange).toHaveBeenCalledTimes(1)
    view.final('1-1', '')
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('renders errors as text, never as markup', () => {
    const view = new TranscriptView(panels)
    view.error('<img src=x onerror="alert(1)">')
    expect(panels.transcription.querySelector('img')).toBeNull()
    expect(panels.transcription.textContent).toContain('<img')
  })
})

describe('speech', () => {
  const voice = (lang: string, localService = true) => ({ lang, localService, name: lang }) as SpeechSynthesisVoice

  it('detects Spanish and English text', async () => {
    const { detectLanguage } = await import('../src/speech')
    expect(detectLanguage('I went to the office and bought something.')).toBe('en')
    expect(detectLanguage('Ayer fui a la oficina y compré algo para el equipo.')).toBe('es')
    expect(detectLanguage('¿Qué tal?')).toBe('es')
  })

  it('prefers an installed voice for the language', async () => {
    const { pickVoice } = await import('../src/speech')
    const voices = [voice('es-MX', false), voice('en-US'), voice('es-ES')]
    expect(pickVoice(voices, 'es')?.lang).toBe('es-ES')
    expect(pickVoice(voices, 'en')?.lang).toBe('en-US')
    expect(pickVoice([voice('fr-FR')], 'en')).toBeNull()
  })

  describe('Speaker', () => {
    let spoken: SpeechSynthesisUtterance[]

    beforeEach(() => {
      spoken = []
      ;(globalThis as any).SpeechSynthesisUtterance = class {
        text: string
        lang = ''
        voice: SpeechSynthesisVoice | null = null
        onend: (() => void) | null = null
        onerror: (() => void) | null = null
        constructor(text: string) { this.text = text }
      }
      ;(globalThis as any).speechSynthesis = {
        getVoices: () => [voice('en-US'), voice('es-ES')],
        speak: (u: SpeechSynthesisUtterance) => { spoken.push(u) },
        cancel: vi.fn(),
      }
    })

    it('reads the text with a matching voice and reports the end once', async () => {
      const { Speaker } = await import('../src/speech')
      const speaker = new Speaker()
      const onEnd = vi.fn()
      speaker.speak('Hola, ¿cómo estás?', onEnd)
      expect(speaker.isSpeaking).toBe(true)
      expect(spoken[0].lang).toBe('es-ES')
      expect(spoken[0].voice?.lang).toBe('es-ES')

      spoken[0].onend!(new Event('end') as SpeechSynthesisEvent)
      spoken[0].onerror!(new Event('error') as SpeechSynthesisErrorEvent)
      expect(speaker.isSpeaking).toBe(false)
      expect(onEnd).toHaveBeenCalledTimes(1)
    })

    it('stops immediately, ignoring late events from the cancelled utterance', async () => {
      const { Speaker } = await import('../src/speech')
      const speaker = new Speaker()
      const first = vi.fn()
      const second = vi.fn()
      speaker.speak('one', first)
      speaker.speak('two', second) // replaces the first
      expect(first).toHaveBeenCalledTimes(1)
      spoken[0].onend!(new Event('end') as SpeechSynthesisEvent) // late event of the first
      expect(speaker.isSpeaking).toBe(true)
      expect(second).not.toHaveBeenCalled()

      speaker.stop()
      expect(second).toHaveBeenCalledTimes(1)
      expect(speaker.isSpeaking).toBe(false)
    })
  })
})

describe('endsSentence()', () => {
  it.each([
    ['I would like to work.', true],
    ['¿Vienes mañana?', true],
    ['She said "yes."', true],
    ['I would like', false],
    ['I would like.', false],       // whisper often adds a period after a dangling word
    ['Quiero hablar de.', false],
    ['Well, I think...', false],
    ['', false],
  ])('%j -> %s', (text, expected) => {
    // Act
    const complete = endsSentence(text)

    // Assert
    expect(complete).toBe(expected)
  })
})
