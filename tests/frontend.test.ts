/**
 * VocalFix – Frontend Unit Tests
 *
 * Tests cover:
 *  1. Navigation system (data-path routing)
 *  2. Editor helpers (dropdowns, record button, typing check)
 *  3. AudioRecorder class (unit)
 *  4. Settings pages and index.html structure
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vitest runs from the repo root
const readRepoFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  id?: string,
  extra?: Partial<HTMLElementTagNameMap[K]>,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (id) el.id = id
  if (extra) Object.assign(el, extra)
  document.body.appendChild(el)
  return el
}

function cleanDOM() {
  document.body.innerHTML = ''
}

// ─────────────────────────────────────────────────────────────
// 1. Navigation – initNavigation()
// ─────────────────────────────────────────────────────────────

describe('initNavigation()', () => {
  beforeEach(cleanDOM)

  it('navigates to /index.html when data-path="editor"', async () => {
    const { initNavigation } = await import('../src/navigation')
    const link = createEl('a')
    link.setAttribute('data-path', 'editor')
    document.body.appendChild(link)

    initNavigation()

    // Simulate click
    const originalHref = Object.getOwnPropertyDescriptor(window.location, 'href')
    const assignSpy = vi.spyOn(window.location, 'href', 'set')
    link.click()
    expect(assignSpy).toHaveBeenCalledWith('/index.html')
    assignSpy.mockRestore()
    if (originalHref) Object.defineProperty(window.location, 'href', originalHref)
  })

  it('navigates to /pages/settings.html when data-path="modelos-locales"', async () => {
    const { initNavigation } = await import('../src/navigation')
    const link = createEl('a')
    link.setAttribute('data-path', 'modelos-locales')
    document.body.appendChild(link)

    initNavigation()

    const assignSpy = vi.spyOn(window.location, 'href', 'set')
    link.click()
    expect(assignSpy).toHaveBeenCalledWith('/pages/settings.html')
    assignSpy.mockRestore()
  })

  it('routes the editor settings button (data-path="ajustes") to /pages/settings.html', async () => {
    const { initNavigation } = await import('../src/navigation')
    const btn = createEl('button')
    btn.setAttribute('data-path', 'ajustes')

    initNavigation()

    const assignSpy = vi.spyOn(window.location, 'href', 'set')
    btn.click()
    expect(assignSpy).toHaveBeenCalledWith('/pages/settings.html')
    assignSpy.mockRestore()
  })

  it('navigates to /pages/atajos-teclado-hotkeys.html', async () => {
    const { initNavigation } = await import('../src/navigation')
    const btn = createEl('button')
    btn.setAttribute('data-path', 'atajos-teclado-hotkeys')
    document.body.appendChild(btn)

    initNavigation()

    const assignSpy = vi.spyOn(window.location, 'href', 'set')
    btn.click()
    expect(assignSpy).toHaveBeenCalledWith('/pages/atajos-teclado-hotkeys.html')
    assignSpy.mockRestore()
  })

  it('navigates to /pages/reglas-gramaticales-estilo.html', async () => {
    const { initNavigation } = await import('../src/navigation')
    const btn = createEl('button')
    btn.setAttribute('data-path', 'reglas-gramaticales-estilo')
    document.body.appendChild(btn)

    initNavigation()

    const assignSpy = vi.spyOn(window.location, 'href', 'set')
    btn.click()
    expect(assignSpy).toHaveBeenCalledWith('/pages/reglas-gramaticales-estilo.html')
    assignSpy.mockRestore()
  })

  it('does not navigate for unknown data-path (logs to console)', async () => {
    const { initNavigation } = await import('../src/navigation')
    const btn = createEl('button')
    btn.setAttribute('data-path', 'nonexistent-path')
    document.body.appendChild(btn)

    initNavigation()

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const assignSpy = vi.spyOn(window.location, 'href', 'set')
    btn.click()
    expect(assignSpy).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('not implemented'),
      'nonexistent-path',
    )
    consoleSpy.mockRestore()
    assignSpy.mockRestore()
  })

  it('prevents default link navigation on click', async () => {
    const { initNavigation } = await import('../src/navigation')
    const link = createEl('a')
    link.href = 'http://external.site'
    link.setAttribute('data-path', 'editor')
    document.body.appendChild(link)

    initNavigation()

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    const preventSpy = vi.spyOn(event, 'preventDefault')
    link.dispatchEvent(event)
    expect(preventSpy).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
// 2. Editor helpers (src/editor.ts)
// ─────────────────────────────────────────────────────────────

describe('fillMicrophoneSelect()', () => {
  beforeEach(cleanDOM)

  it('adds a default option plus each device, naming unlabeled ones', async () => {
    const { fillMicrophoneSelect } = await import('../src/editor')
    const select = createEl('select')
    fillMicrophoneSelect(select, [
      { deviceId: 'a', label: 'MacBook Mic' },
      { deviceId: 'b', label: '' },
    ] as MediaDeviceInfo[])
    expect([...select.options].map(o => [o.text, o.value])).toEqual([
      ['Predeterminado', ''], ['MacBook Mic', 'a'], ['Micrófono 2', 'b'],
    ])
  })
})

describe('renderRecordButton()', () => {
  beforeEach(cleanDOM)

  it.each([
    ['idle', 'Grabar'],
    ['listening', 'Detener'],
  ] as const)('renders the %s state', async (state, label) => {
    const { renderRecordButton } = await import('../src/editor')
    const btn = createEl('button')
    renderRecordButton(btn, state)
    expect(btn.dataset.state).toBe(state)
    expect(btn.textContent).toContain(label)
  })

  it('pulses the dot only while listening', async () => {
    const { renderRecordButton } = await import('../src/editor')
    const btn = createEl('button')
    renderRecordButton(btn, 'listening')
    expect(btn.querySelector('.animate-pulse')).not.toBeNull()
    renderRecordButton(btn, 'idle')
    expect(btn.querySelector('.animate-pulse')).toBeNull()
  })
})

describe('formatElapsed()', () => {
  it.each([
    [0, '00:00'],
    [9.9, '00:09'],
    [65, '01:05'],
    [600, '10:00'],
  ])('formats %s seconds as %s', async (seconds, expected) => {
    // Arrange
    const { formatElapsed } = await import('../src/editor')

    // Act
    const text = formatElapsed(seconds)

    // Assert
    expect(text).toBe(expected)
  })
})

describe('renderRecordButton() timer', () => {
  beforeEach(cleanDOM)

  it('shows the recording time only while listening', async () => {
    // Arrange
    const { renderRecordButton } = await import('../src/editor')
    const btn = createEl('button')

    // Act
    renderRecordButton(btn, 'listening')
    const whileListening = btn.querySelector('[data-rec-time]')?.textContent
    renderRecordButton(btn, 'idle')

    // Assert
    expect(whileListening).toBe('00:00')
    expect(btn.querySelector('[data-rec-time]')).toBeNull()
  })
})

describe('renderRecordButton() while the speech model loads', () => {
  beforeEach(cleanDOM)

  it('disables the button and says why', async () => {
    // Arrange
    const { renderRecordButton } = await import('../src/editor')
    const btn = createEl('button')

    // Act
    renderRecordButton(btn, 'loading')

    // Assert
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toContain('Cargando modelo')
  })

  it('enables it again once the model is ready', async () => {
    // Arrange
    const { renderRecordButton } = await import('../src/editor')
    const btn = createEl('button')
    renderRecordButton(btn, 'loading')

    // Act
    renderRecordButton(btn, 'idle')

    // Assert
    expect(btn.disabled).toBe(false)
  })
})

describe('restingRecordState()', () => {
  const info = (state: 'loading' | 'ready' | 'missing' | 'error') => ({ state, message: '' })

  it.each([
    ['ready', 'ready', 'idle'],
    ['ready', 'loading', 'loading'],
    ['loading', 'ready', 'loading'],
    ['ready', 'missing', 'unavailable'],
    ['error', 'ready', 'unavailable'],
    ['loading', 'missing', 'unavailable'],
  ] as const)('whisper %s + LLM %s -> %s', async (whisper, llm, expected) => {
    // Arrange
    const { restingRecordState } = await import('../src/editor')

    // Act
    const state = restingRecordState({ whisper: info(whisper), llm: info(llm) })

    // Assert
    expect(state).toBe(expected)
  })

  it('disables the record button when a model is unavailable', async () => {
    // Arrange
    const { renderRecordButton } = await import('../src/editor')
    const btn = createEl('button')

    // Act
    renderRecordButton(btn, 'unavailable')

    // Assert
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toContain('Modelo no disponible')
  })
})

describe('renderEngineDot()', () => {
  beforeEach(cleanDOM)

  it.each([
    ['loading', 'cargando…'],
    ['ready', 'listo'],
    ['missing', 'sin descargar'],
    ['error', 'error'],
  ] as const)('marks a %s model and describes it', async (state, label) => {
    // Arrange
    const { renderEngineDot } = await import('../src/editor')
    const dot = createEl('span')

    // Act
    const tip = renderEngineDot(dot, 'Transcripción', { state, message: '' })

    // Assert
    expect(dot.dataset.state).toBe(state)
    expect(tip).toBe(`Transcripción: ${label}`)
  })

  it('includes the reason a model is unusable', async () => {
    // Arrange
    const { renderEngineDot } = await import('../src/editor')
    const dot = createEl('span')

    // Act
    const tip = renderEngineDot(dot, 'Motor lingüístico', { state: 'missing', message: 'Modelo no descargado' })

    // Assert
    expect(tip).toBe('Motor lingüístico: sin descargar (Modelo no descargado)')
  })
})

describe('level meter', () => {
  beforeEach(cleanDOM)

  it.each([
    [0, 0],
    [0.01, 0.22],
    [0.25, 1],
    [1, 1],
  ])('maps an RMS of %s to a level of %s', async (rms, expected) => {
    // Arrange
    const { levelFromRms } = await import('../src/editor')

    // Act
    const level = levelFromRms(rms)

    // Assert
    expect(level).toBeCloseTo(expected, 2)
  })

  it('shows the newest level on the right and flattens on reset', async () => {
    // Arrange
    const { createLevelMeter } = await import('../src/editor')
    const container = createEl('div')
    const meter = createLevelMeter(container)
    const heights = () => [...container.children].map(bar => (bar as HTMLElement).style.height)

    // Act
    meter.push(0.25)
    const whileSpeaking = heights()
    meter.reset()

    // Assert
    expect(whileSpeaking.at(-1)).toBe('20px')
    expect(whileSpeaking.at(-2)).toBe('3px')
    expect(new Set(heights())).toEqual(new Set(['3px']))
  })
})

describe('isTypingTarget()', () => {
  it('is true for form controls and false otherwise', async () => {
    const { isTypingTarget } = await import('../src/editor')
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('select'))).toBe(true)
    expect(isTypingTarget(document.createElement('button'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// 9. AudioRecorder unit tests (no real microphone needed)
// ─────────────────────────────────────────────────────────────

describe('AudioRecorder', () => {
  it('setMicrophone stores deviceId', async () => {
    const { AudioRecorder } = await import('../src/audio-recorder')
    const recorder = new AudioRecorder()
    recorder.setMicrophone('device-123')
    // Access private via any
    expect((recorder as any).currentDeviceId).toBe('device-123')
  })

  it('getMicrophones returns empty array when getUserMedia is denied', async () => {
    const { AudioRecorder } = await import('../src/audio-recorder')
    // Mock denied permission
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
      writable: true,
    })

    const recorder = new AudioRecorder()
    const result = await recorder.getMicrophones()
    expect(result).toEqual([])
  })

  it('getMicrophones returns only audioinput devices', async () => {
    const { AudioRecorder } = await import('../src/audio-recorder')

    const fakeDevices: Partial<MediaDeviceInfo>[] = [
      { kind: 'audioinput', deviceId: 'mic1', label: 'Mic 1' },
      { kind: 'videoinput', deviceId: 'cam1', label: 'Camera' },
      { kind: 'audiooutput', deviceId: 'out1', label: 'Speakers' },
    ]

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({}),
        enumerateDevices: vi.fn().mockResolvedValue(fakeDevices),
      },
      writable: true,
    })

    const recorder = new AudioRecorder()
    const result = await recorder.getMicrophones()
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('audioinput')
  })
})

// ─────────────────────────────────────────────────────────────
// 10. Settings pages — back button exists and points to /index.html
// ─────────────────────────────────────────────────────────────

describe('Settings pages structure', () => {
  const pages = [
    'pages/settings.html',
    'pages/atajos-teclado-hotkeys.html',
    'pages/reglas-gramaticales-estilo.html',
  ]

  pages.forEach(page => {
    it(`${page} contains a back button with data-path="editor"`, () => {
      const content = readRepoFile(page)
      expect(content).toContain('Volver al editor')
      expect(content).toContain('data-path="editor"')
    })

    it(`${page} includes /src/settings.ts module script`, () => {
      const content = readRepoFile(page)
      expect(content).toContain('/src/settings.ts')
    })

    it(`${page} does NOT contain a footer element`, () => {
      const content = readRepoFile(page)
      expect(content).not.toMatch(/<footer[\s>]/)
    })

    it(`${page} uses the shared sidebar and declares its page id`, () => {
      const content = readRepoFile(page)
      expect(content).toContain('id="settings-nav"')
      expect(content).toMatch(/<body[^>]*data-page="(models|rules|shortcuts)"/)
    })
  })
})

// ─────────────────────────────────────────────────────────────
// 11. index.html structure checks
// ─────────────────────────────────────────────────────────────

describe('index.html structure', () => {
  let content: string

  beforeEach(() => {
    content = readRepoFile('index.html')
  })

  it('has #btn-settings button routed through navigation', () => {
    expect(content).toMatch(/id="btn-settings"[^>]*data-path="ajustes"/)
  })

  it('has #recordToggleBtn button', () => {
    expect(content).toContain('id="recordToggleBtn"')
  })

  it('has #live-transcription container', () => {
    expect(content).toContain('id="live-transcription"')
  })

  it('has #grammar-review-container', () => {
    expect(content).toContain('id="grammar-review-container"')
  })

  it('has #primary-recommendation', () => {
    expect(content).toContain('id="primary-recommendation"')
  })

  it('has #copyBtn', () => {
    expect(content).toContain('id="copyBtn"')
  })

  it('has the models pill routed to the models page', () => {
    expect(content).toMatch(/id="models-pill"[^>]*data-path="modelos-locales"/)
    expect(content).toContain('id="stt-model-label"')
    expect(content).toContain('id="llm-model-label"')
  })

  it('has #tone-select', () => {
    expect(content).toContain('id="tone-select"')
  })

  it('has #mic-select', () => {
    expect(content).toContain('id="mic-select"')
  })

  it('btn-settings has -webkit-app-region: no-drag', () => {
    expect(content).toMatch(/id="btn-settings"[^>]*-webkit-app-region:\s*no-drag|btn-settings[^>]*style="[^"]*no-drag/)
  })

  it('imports /src/main.ts as module', () => {
    expect(content).toContain('src="/src/main.ts"')
  })
})
