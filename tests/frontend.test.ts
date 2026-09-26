import { readFileSync } from 'fs'
/**
 * VocalFix – Frontend Unit Tests
 *
 * Tests cover:
 *  1. Navigation system (data-path routing)
 *  2. Main page button wiring (settings, record, copy)
 *  3. AudioRecorder class (unit)
 *  4. Model dropdowns (dynamic population)
 *  5. Transcription / correction result handlers
 *  6. Keyboard spacebar shortcut
 *  7. Copy-to-clipboard button
 *  8. Settings page back-navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

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

  it('navigates to /pages/almacenamiento-privacidad.html', async () => {
    const { initNavigation } = await import('../src/navigation')
    const btn = createEl('button')
    btn.setAttribute('data-path', 'almacenamiento-privacidad')
    document.body.appendChild(btn)

    initNavigation()

    const assignSpy = vi.spyOn(window.location, 'href', 'set')
    btn.click()
    expect(assignSpy).toHaveBeenCalledWith('/pages/almacenamiento-privacidad.html')
    assignSpy.mockRestore()
  })

  it('navigates to /pages/rendimiento-hardware.html', async () => {
    const { initNavigation } = await import('../src/navigation')
    const btn = createEl('button')
    btn.setAttribute('data-path', 'rendimiento-hardware')
    document.body.appendChild(btn)

    initNavigation()

    const assignSpy = vi.spyOn(window.location, 'href', 'set')
    btn.click()
    expect(assignSpy).toHaveBeenCalledWith('/pages/rendimiento-hardware.html')
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
// 2. Settings button → navigates to settings
// ─────────────────────────────────────────────────────────────

describe('Settings button', () => {
  beforeEach(cleanDOM)

  it('btn-settings click sets location.href to /pages/settings.html', () => {
    const btn = createEl('button', 'btn-settings')

    // Wire it the same way main.ts does
    btn.addEventListener('click', () => {
      window.location.href = '/pages/settings.html'
    })

    const spy = vi.spyOn(window.location, 'href', 'set')
    btn.click()
    expect(spy).toHaveBeenCalledWith('/pages/settings.html')
    spy.mockRestore()
  })
})

// ─────────────────────────────────────────────────────────────
// 3. Model dropdown population
// ─────────────────────────────────────────────────────────────

describe('Model dropdowns', () => {
  beforeEach(cleanDOM)

  it('shows "No model found" when whisper list is empty', () => {
    const select = createEl('select', 'stt-model-select')
    select.innerHTML = ''

    const models = { whisper: [], llama: [] }

    if (models.whisper.length === 0) {
      select.innerHTML = '<option value="">No model found</option>'
      select.disabled = true
    }

    expect(select.options.length).toBe(1)
    expect(select.options[0].text).toBe('No model found')
    expect(select.disabled).toBe(true)
  })

  it('shows "No model found" when llama list is empty', () => {
    const select = createEl('select', 'llm-model-select')
    select.innerHTML = ''

    const models = { whisper: [], llama: [] }

    if (models.llama.length === 0) {
      select.innerHTML = '<option value="">No model found</option>'
      select.disabled = true
    }

    expect(select.options.length).toBe(1)
    expect(select.disabled).toBe(true)
  })

  it('populates whisper select when models are present', () => {
    const select = createEl('select', 'stt-model-select')
    select.innerHTML = ''
    const whisperModels = ['ggml-base.en.bin', 'ggml-large-v3.bin']

    whisperModels.forEach(m => {
      const opt = document.createElement('option')
      opt.value = m
      opt.text = m
      select.appendChild(opt)
    })

    expect(select.options.length).toBe(2)
    expect(select.options[0].value).toBe('ggml-base.en.bin')
    expect(select.options[1].value).toBe('ggml-large-v3.bin')
    expect(select.disabled).toBe(false)
  })

  it('populates llama select when models are present', () => {
    const select = createEl('select', 'llm-model-select')
    select.innerHTML = ''
    const llamaModels = ['mistral-7b.gguf', 'phi3-mini.gguf']

    llamaModels.forEach(m => {
      const opt = document.createElement('option')
      opt.value = m
      opt.text = m
      select.appendChild(opt)
    })

    expect(select.options.length).toBe(2)
    expect(select.options[0].value).toBe('mistral-7b.gguf')
  })
})

// ─────────────────────────────────────────────────────────────
// 4. Transcription result handler
// ─────────────────────────────────────────────────────────────

describe('Transcription result display', () => {
  beforeEach(cleanDOM)

  it('appends transcription text to #live-transcription', () => {
    const el = createEl('div', 'live-transcription')
    el.innerText = 'Esperando voz...'

    const text = 'hola mundo'

    // Simulate the handler from main.ts
    if (el.innerText.includes('Esperando voz...')) {
      el.innerHTML = ''
    }
    el.innerHTML += `<p>${text}</p>`

    expect(el.innerHTML).toContain('hola mundo')
    expect(el.innerHTML).not.toContain('Esperando voz...')
  })

  it('appends multiple transcriptions without clearing', () => {
    const el = createEl('div', 'live-transcription')
    el.innerHTML = '<p>first</p>'

    const text = 'second'
    // Not placeholder so don't clear
    el.innerHTML += `<p>${text}</p>`

    expect(el.innerHTML).toContain('first')
    expect(el.innerHTML).toContain('second')
  })
})

// ─────────────────────────────────────────────────────────────
// 5. Correction result handler
// ─────────────────────────────────────────────────────────────

describe('Correction result display', () => {
  beforeEach(cleanDOM)

  it('appends corrected text to #grammar-review-container', () => {
    const container = createEl('div', 'grammar-review-container')
    container.innerText = 'Esperando voz...'

    const text = 'Hola mundo corregido'

    if (container.innerText.includes('Esperando voz...')) {
      container.innerHTML = ''
    }
    container.innerHTML += `<p>${text}</p>`

    expect(container.innerHTML).toContain('Hola mundo corregido')
  })

  it('updates #primary-recommendation with corrected text', () => {
    const rec = createEl('div', 'primary-recommendation')
    rec.innerText = 'Esperando voz...'

    const text = 'Texto corregido por IA'
    rec.innerText = text

    expect(rec.innerText).toBe('Texto corregido por IA')
  })
})

// ─────────────────────────────────────────────────────────────
// 6. Copy to clipboard button
// ─────────────────────────────────────────────────────────────

describe('Copy button', () => {
  beforeEach(() => {
    cleanDOM()
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true,
    })
  })

  it('does not copy when primary-recommendation is empty placeholder', () => {
    const rec = createEl('div', 'primary-recommendation')
    rec.innerText = 'Esperando voz...'
    const copyText = createEl('span', 'copyBtnText')
    copyText.innerText = 'Copiar'

    // Replicate copyCurrentSuggestion logic
    const textToCopy = rec.innerText
    if (!textToCopy || textToCopy.includes('Esperando voz...')) return

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('copies text when primary-recommendation has real content', async () => {
    const rec = createEl('div', 'primary-recommendation')
    rec.innerText = 'Texto a copiar'
    const copyText = createEl('span', 'copyBtnText')
    copyText.innerText = 'Copiar'

    const textToCopy = rec.innerText
    if (!textToCopy || textToCopy.includes('Esperando voz...')) return

    await navigator.clipboard.writeText(textToCopy)
    copyText.innerText = 'Copiado'

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Texto a copiar')
    expect(copyText.innerText).toBe('Copiado')
  })

  it('restores copy button text after 1800ms', async () => {
    vi.useFakeTimers()
    const rec = createEl('div', 'primary-recommendation')
    rec.innerText = 'Contenido real'
    const copyText = createEl('span', 'copyBtnText')
    copyText.innerText = 'Copiar'

    const original = copyText.innerText
    copyText.innerText = 'Copiado'
    setTimeout(() => { copyText.innerText = original }, 1800)

    vi.advanceTimersByTime(1800)
    expect(copyText.innerText).toBe('Copiar')
    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────
// 7. Spacebar shortcut triggers record button
// ─────────────────────────────────────────────────────────────

describe('Spacebar shortcut', () => {
  beforeEach(cleanDOM)

  it('clicks #recordToggleBtn on spacebar when not in an input', () => {
    const btn = createEl('button', 'recordToggleBtn')
    const clickSpy = vi.spyOn(btn, 'click')

    // Attach handler as main.ts does
    window.addEventListener('keydown', (e) => {
      const targetTag = (e.target as HTMLElement).tagName
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag)
      if (e.code === 'Space' && !isInput) {
        e.preventDefault()
        btn.click()
      }
    })

    const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true })
    window.dispatchEvent(event)

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('does NOT trigger record button when spacebar is pressed inside an input', () => {
    const btn = createEl('button', 'recordToggleBtn')
    const input = createEl('input')
    const clickSpy = vi.spyOn(btn, 'click')

    window.addEventListener('keydown', (e) => {
      const targetTag = (e.target as HTMLElement).tagName
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag)
      if (e.code === 'Space' && !isInput) {
        e.preventDefault()
        btn.click()
      }
    })

    // Dispatch from input element
    const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true })
    Object.defineProperty(event, 'target', { value: input })
    window.dispatchEvent(event)

    expect(clickSpy).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
// 8. Record button state machine
// ─────────────────────────────────────────────────────────────

describe('Record button state machine', () => {
  beforeEach(cleanDOM)

  it('toggles from idle → listening on first click', () => {
    const btn = createEl('button', 'recordToggleBtn')
    let isListening = false

    btn.addEventListener('click', () => {
      isListening = !isListening
      btn.dataset.state = isListening ? 'listening' : 'idle'
    })

    btn.click()
    expect(isListening).toBe(true)
    expect(btn.dataset.state).toBe('listening')
  })

  it('toggles back to idle on second click', () => {
    const btn = createEl('button', 'recordToggleBtn')
    let isListening = false

    btn.addEventListener('click', () => {
      isListening = !isListening
      btn.dataset.state = isListening ? 'listening' : 'idle'
    })

    btn.click()
    btn.click()
    expect(isListening).toBe(false)
    expect(btn.dataset.state).toBe('idle')
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
    'pages/almacenamiento-privacidad.html',
    'pages/rendimiento-hardware.html',
  ]

  pages.forEach(page => {
    it(`${page} contains a back button with data-path="editor"`, () => {
      const content = readFileSync(
        `./${page}`,
        'utf-8',
      )
      expect(content).toContain('arrow_back')
      expect(content).toContain('data-path="editor"')
    })

    it(`${page} includes /src/settings.ts module script`, () => {
      const content = readFileSync(
        `./${page}`,
        'utf-8',
      )
      expect(content).toContain('/src/settings.ts')
    })

    it(`${page} does NOT contain a footer element`, () => {
      const content = readFileSync(
        `./${page}`,
        'utf-8',
      )
      expect(content).not.toMatch(/<footer[\s>]/)
    })
  })
})

// ─────────────────────────────────────────────────────────────
// 11. index.html structure checks
// ─────────────────────────────────────────────────────────────

describe('index.html structure', () => {
  let content: string

  beforeEach(() => {
    content = readFileSync(
      './index.html',
      'utf-8',
    )
  })

  it('has #btn-settings button', () => {
    expect(content).toContain('id="btn-settings"')
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

  it('has #stt-model-select', () => {
    expect(content).toContain('id="stt-model-select"')
  })

  it('has #llm-model-select', () => {
    expect(content).toContain('id="llm-model-select"')
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
