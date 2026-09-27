/**
 * VocalFix – Frontend Unit Tests
 *
 * Tests cover:
 *  1. Navigation system (data-path routing)
 *  2. Editor helpers (dropdowns, result lines, record button, typing check)
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

describe('fillModelSelect()', () => {
  beforeEach(cleanDOM)

  it('shows a disabled "No model found" option when the list is empty', async () => {
    const { fillModelSelect } = await import('../src/editor')
    const select = createEl('select')
    fillModelSelect(select, [])
    expect([...select.options].map(o => o.text)).toEqual(['No model found'])
    expect(select.disabled).toBe(true)
  })

  it('lists files by short name, keeping the file name as value', async () => {
    const { fillModelSelect } = await import('../src/editor')
    const select = createEl('select')
    select.disabled = true
    fillModelSelect(select, ['ggml-base.bin', 'custom.gguf'])
    expect([...select.options].map(o => [o.text, o.value])).toEqual([['Base', 'ggml-base.bin'], ['custom', 'custom.gguf']])
    expect(select.disabled).toBe(false)
  })

  it('replaces previous options when called again', async () => {
    const { fillModelSelect } = await import('../src/editor')
    const select = createEl('select')
    fillModelSelect(select, ['ggml-base.bin'])
    fillModelSelect(select, ['ggml-small.bin'])
    expect(select.options).toHaveLength(1)
  })
})

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

describe('appendLine()', () => {
  beforeEach(cleanDOM)

  it('clears the placeholder on the first line only', async () => {
    const { appendLine, PLACEHOLDER } = await import('../src/editor')
    const el = createEl('div')
    el.innerText = PLACEHOLDER
    appendLine(el, 'hola', 'a')
    appendLine(el, 'mundo', 'b')
    expect([...el.querySelectorAll('p')].map(p => [p.textContent, p.className])).toEqual([['hola', 'a'], ['mundo', 'b']])
  })

  it('renders text literally, never as markup', async () => {
    const { appendLine } = await import('../src/editor')
    const el = createEl('div')
    appendLine(el, '<img src=x onerror="alert(1)">', '')
    expect(el.querySelector('img')).toBeNull()
    expect(el.textContent).toContain('<img')
  })
})

describe('renderRecordButton()', () => {
  beforeEach(cleanDOM)

  it.each([
    ['idle', 'En pausa'],
    ['listening', 'Escuchando'],
    ['processing', 'Procesando AI...'],
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
    renderRecordButton(btn, 'processing')
    expect(btn.querySelector('.animate-pulse')).toBeNull()
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
      expect(content).toContain('arrow_back')
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
