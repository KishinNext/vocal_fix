/**
 * VocalFix – Settings logic tests (pure modules shared by main and renderer)
 */

import { mkdtempSync, readFileSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DEFAULT_SETTINGS, DEFAULT_TEMPERATURE, PROFILES, sanitizeSettings } from '../electron/settingsSchema'
import { DEFAULT_PROMPTS, buildGrammarPrompt, buildSystemPrompt, promptExamples, wrapTranscript } from '../electron/prompt'
import { LLM_MODELS, WHISPER_MODELS, findCatalogModel, isLlmFile, isWhisperFile, modelDisplayName, recommendedModels,
} from '../electron/modelCatalog'
import { acceleratorToLabels, eventToAccelerator, modifierHint } from '../src/settings/accelerator'
import { resolveAppFile } from '../electron/appFiles'
import { downloadModel } from '../electron/modelDownloader'
import { isServerProcess } from '../electron/whisperOrphan'
import { SETTINGS_SECTIONS, errorMessage, escapeHtml, formatBytes, memoryFit, renderSettingsNav } from '../src/settings/shared'

// The shortcut helpers follow the platform; these tests pin macOS unless they say otherwise
const toAccelerator = (event: Parameters<typeof eventToAccelerator>[0]) => eventToAccelerator(event, true)
const toLabels = (accelerator: string) => acceleratorToLabels(accelerator, true)

function key(code: string, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {}) {
  return { code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods }
}

describe('sanitizeSettings()', () => {
  it('returns defaults for empty or invalid input', () => {
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings('garbage')).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid values and drops invalid enums', () => {
    const result = sanitizeSettings({ language: 'es', intervention: 'nope', profile: 'business' })
    expect(result.language).toBe('es')
    expect(result.intervention).toBe(DEFAULT_SETTINGS.intervention)
    expect(result.profile).toBe('business')
  })

  it('clamps temperature to [0, 1] and ignores non-numeric values', () => {
    expect(sanitizeSettings({ temperature: 5 }).temperature).toBe(1)
    expect(sanitizeSettings({ temperature: -1 }).temperature).toBe(0)
    expect(sanitizeSettings({ temperature: 'hot' }).temperature).toBe(DEFAULT_SETTINGS.temperature)
    expect(sanitizeSettings({ temperature: null }).temperature).toBe(DEFAULT_SETTINGS.temperature)
  })

  it('merges a partial patch over the given base', () => {
    const base = sanitizeSettings({ language: 'en', glossary: ['Kubernetes'] })
    const result = sanitizeSettings({ profile: 'academic' }, base)
    expect(result.language).toBe('en')
    expect(result.glossary).toEqual(['Kubernetes'])
    expect(result.profile).toBe('academic')
  })

  it('trims, dedupes and filters glossary terms', () => {
    const result = sanitizeSettings({ glossary: [' VocalFix ', 'VocalFix', '', 42, 'Metal'] })
    expect(result.glossary).toEqual(['VocalFix', 'Metal'])
  })

  it('merges rules field by field', () => {
    const result = sanitizeSettings({ rules: { normalizeContractions: true } })
    expect(result.rules).toEqual({ removeFillers: DEFAULT_SETTINGS.rules.removeFillers, normalizeContractions: true })
  })

  it('allows an empty record shortcut (disabled)', () => {
    expect(sanitizeSettings({ recordShortcut: '' }).recordShortcut).toBe('')
  })

  it('defaults to catalog models that exist', () => {
    expect(findCatalogModel(DEFAULT_SETTINGS.whisperModel)?.kind).toBe('whisper')
    expect(findCatalogModel(DEFAULT_SETTINGS.llmModel)?.kind).toBe('llm')
  })
})

describe('buildGrammarPrompt()', () => {
  it('only fixes errors and ignores tone and intervention', () => {
    const casual = buildGrammarPrompt({ ...DEFAULT_SETTINGS, profile: 'conversational', intervention: 'creative' })
    const formal = buildGrammarPrompt({ ...DEFAULT_SETTINGS, profile: 'business', intervention: 'minimal' })
    expect(casual).toContain('Change as little as possible')
    expect(casual).toEqual(formal)
  })

  it('shares the rules and glossary with the natural expression', () => {
    const settings = { ...DEFAULT_SETTINGS, rules: { removeFillers: true, normalizeContractions: false }, glossary: ['VocalFix'] }
    expect(buildGrammarPrompt(settings)).toContain('filler')
    expect(buildGrammarPrompt(settings)).toContain('VocalFix')
  })
})

describe('buildSystemPrompt()', () => {
  it('changes with the intervention level', () => {
    const minimal = buildSystemPrompt({ ...DEFAULT_SETTINGS, intervention: 'minimal' })
    const creative = buildSystemPrompt({ ...DEFAULT_SETTINGS, intervention: 'creative' })
    expect(minimal).toContain('Do not rephrase')
    expect(creative).toContain('Rewrite freely')
    expect(minimal).not.toEqual(creative)
  })

  it('includes the profile instruction', () => {
    expect(buildSystemPrompt({ ...DEFAULT_SETTINGS, profile: 'es-en' })).toContain('native Spanish speaker')
    expect(buildSystemPrompt({ ...DEFAULT_SETTINGS, profile: 'business' })).toContain('business email')
  })

  it('adds rule instructions only when enabled', () => {
    const off = buildSystemPrompt({ ...DEFAULT_SETTINGS, rules: { removeFillers: false, normalizeContractions: false } })
    const on = buildSystemPrompt({ ...DEFAULT_SETTINGS, rules: { removeFillers: true, normalizeContractions: true } })
    expect(off).not.toContain('filler')
    expect(off).not.toContain('contractions')
    expect(on).toContain('filler')
    expect(on).toContain('contractions')
  })

  it('lists glossary terms when present', () => {
    expect(buildSystemPrompt({ ...DEFAULT_SETTINGS, glossary: [] })).not.toContain('exactly as written')
    expect(buildSystemPrompt({ ...DEFAULT_SETTINGS, glossary: ['VocalFix', 'Metal'] }))
      .toContain('Keep these terms exactly as written: VocalFix, Metal.')
  })

  it('maps each intervention to an increasing default temperature', () => {
    expect(DEFAULT_TEMPERATURE.minimal).toBeLessThan(DEFAULT_TEMPERATURE.balanced)
    expect(DEFAULT_TEMPERATURE.balanced).toBeLessThan(DEFAULT_TEMPERATURE.creative)
  })
})

describe('model catalog', () => {
  const all = [...WHISPER_MODELS, ...LLM_MODELS]

  it('has unique file names', () => {
    expect(new Set(all.map(m => m.file)).size).toBe(all.length)
  })

  it('uses https Hugging Face URLs ending in the file name', () => {
    all.forEach(m => {
      expect(m.url.startsWith('https://huggingface.co/')).toBe(true)
      expect(m.url.endsWith(`/${m.file}`)).toBe(true)
      expect(m.sizeBytes).toBeGreaterThan(0)
    })
  })

  it('classifies catalog files with the same rule used for the models folder', () => {
    WHISPER_MODELS.forEach(m => expect(isWhisperFile(m.file)).toBe(true))
    LLM_MODELS.forEach(m => expect(isLlmFile(m.file)).toBe(true))
  })

  it('marks .en Whisper models as English-only', () => {
    WHISPER_MODELS.forEach(m => expect(Boolean(m.englishOnly)).toBe(m.file.includes('.en.')))
  })

  it('estimates RAM above the file size for every model (weights + runtime buffers)', () => {
    all.forEach(m => expect(m.ramBytes).toBeGreaterThan(m.sizeBytes))
  })

  it('has a full description for every model', () => {
    all.forEach(m => expect(m.note.length).toBeGreaterThan(20))
  })

  it('modelDisplayName gives short names for the editor dropdowns', () => {
    expect(modelDisplayName('ggml-base.bin')).toBe('Base')
    expect(modelDisplayName('ggml-small.en.bin')).toBe('Small (EN)')
    expect(modelDisplayName('ggml-large-v3-turbo-q5_0.bin')).toBe('Large v3 Turbo Q5')
    expect(modelDisplayName('qwen2.5-0.5b-instruct-q4_k_m.gguf')).toBe('Qwen2.5 0.5B')
    expect(modelDisplayName('my-custom-model.gguf')).toBe('my-custom-model')
  })

  it('ignores partial downloads when classifying files', () => {
    expect(isWhisperFile('ggml-base.bin.part')).toBe(false)
    expect(isLlmFile('model.gguf.part')).toBe(false)
  })
})

describe('toAccelerator()', () => {
  it('builds an accelerator from modifiers and key', () => {
    expect(toAccelerator(key('Space', { metaKey: true, shiftKey: true }))).toBe('Command+Shift+Space')
    expect(toAccelerator(key('KeyR', { altKey: true }))).toBe('Alt+R')
    expect(toAccelerator(key('Digit1', { ctrlKey: true }))).toBe('Control+1')
    expect(toAccelerator(key('F5', { metaKey: true }))).toBe('Command+F5')
  })

  it('returns null while only a modifier is pressed', () => {
    expect(toAccelerator(key('ShiftLeft', { shiftKey: true }))).toBeNull()
  })

  it('rejects combos without a modifier', () => {
    expect(toAccelerator(key('KeyA'))).toBeNull()
  })

  it('rejects unsupported keys', () => {
    expect(toAccelerator(key('IntlBackslash', { metaKey: true }))).toBeNull()
  })
})

describe('toLabels()', () => {
  it('maps modifiers to macOS symbols', () => {
    expect(toLabels('CommandOrControl+Shift+Space')).toEqual(['⌘', '⇧', 'Espacio'])
    expect(toLabels('Alt+R')).toEqual(['⌥', 'R'])
  })

  it('returns no labels for a disabled shortcut', () => {
    expect(toLabels('')).toEqual([])
  })
})

describe('settings shared helpers', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('escapeHtml neutralizes markup', () => {
    expect(escapeHtml('<img src=x onerror="a">')).toBe('&lt;img src=x onerror=&quot;a&quot;&gt;')
  })

  it('formatBytes uses MB below 1 GB and GB above', () => {
    expect(formatBytes(147_951_465)).toBe('148 MB')
    expect(formatBytes(1_533_763_059)).toBe('1.5 GB')
  })

  it('memoryFit classifies RAM usage against the machine total', () => {
    const total = 16e9
    expect(memoryFit(0.8e9, total)).toBeNull()
    expect(memoryFit(4.7e9, total)).toBeNull()
    expect(memoryFit(4.8e9, total)).toBe('ok')
    expect(memoryFit(8e9, total)).toBe('ok')
    expect(memoryFit(8.1e9, total)).toBe('heavy')
  })

  it('memoryFit returns null when RAM is unknown (custom files)', () => {
    expect(memoryFit(0, 16e9)).toBeNull()
    expect(memoryFit(1e9, 0)).toBeNull()
  })

  it('errorMessage strips the IPC invoke prefix', () => {
    const e = new Error("Error invoking remote method 'download-model': Error: Descarga fallida (404 )")
    expect(errorMessage(e)).toBe('Descarga fallida (404 )')
  })

  it('renderSettingsNav renders every section and marks the active one', () => {
    const nav = document.createElement('nav')
    nav.dataset.active = 'reglas-gramaticales-estilo'
    document.body.appendChild(nav)

    renderSettingsNav(nav)

    const buttons = nav.querySelectorAll('button[data-path]')
    expect(buttons).toHaveLength(SETTINGS_SECTIONS.length)
    expect(nav.querySelector('[aria-current="page"]')?.getAttribute('data-path')).toBe('reglas-gramaticales-estilo')
    // Removed sections must not come back
    expect(nav.innerHTML).not.toContain('transcripcion-audio')
    expect(nav.innerHTML).not.toContain('almacenamiento-privacidad')
  })

  it('rendered nav buttons navigate via initNavigation', async () => {
    const { initNavigation } = await import('../src/navigation')
    const nav = document.createElement('nav')
    nav.dataset.active = 'modelos-locales'
    document.body.appendChild(nav)
    renderSettingsNav(nav)
    initNavigation()

    const spy = vi.spyOn(window.location, 'href', 'set')
    nav.querySelector<HTMLButtonElement>('[data-path="atajos-teclado-hotkeys"]')!.click()
    expect(spy).toHaveBeenCalledWith('/pages/atajos-teclado-hotkeys.html')
    spy.mockRestore()
  })
})

describe('concise profile', () => {
  it('is a valid profile with its own instruction', () => {
    expect(sanitizeSettings({ profile: 'concise' }).profile).toBe('concise')
    expect(buildSystemPrompt({ ...DEFAULT_SETTINGS, profile: 'concise' })).toContain('as short as possible')
  })
})

describe('tone select', () => {
  function mountSelect() {
    document.body.innerHTML = '<select id="tone-select"></select>'
    return document.getElementById('tone-select') as HTMLSelectElement
  }

  function mockApi(overrides: Record<string, unknown> = {}) {
    const api = {
      getSettings: vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS, profile: 'business' }),
      updateSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      ...overrides,
    }
    ;(window as any).electronAPI = api
    return api
  }

  const choose = (select: HTMLSelectElement, value: string) => {
    select.value = value
    select.dispatchEvent(new Event('change'))
  }

  const noop = { onChange: vi.fn().mockResolvedValue(undefined), onError: vi.fn() }

  it('offers every profile', async () => {
    // Arrange
    const { initToneSelect } = await import('../src/tone-select')
    mockApi()
    const select = mountSelect()

    // Act
    await initToneSelect(select, noop)

    // Assert
    expect([...select.options].map(o => o.value).sort()).toEqual([...PROFILES].sort())
  })

  it('shows the saved profile on load', async () => {
    // Arrange
    const { initToneSelect } = await import('../src/tone-select')
    mockApi()
    const select = mountSelect()

    // Act
    await initToneSelect(select, noop)

    // Assert
    expect(select.value).toBe('business')
  })

  it('saves the profile before notifying the change', async () => {
    // Arrange
    const { initToneSelect } = await import('../src/tone-select')
    const api = mockApi()
    const select = mountSelect()
    const onChange = vi.fn(async () => {
      expect(api.updateSettings).toHaveBeenCalledWith({ profile: 'concise' })
    })
    await initToneSelect(select, { onChange, onError: vi.fn() })

    // Act
    choose(select, 'concise')

    // Assert
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('concise'))
  })

  it('reports errors from the rewrite', async () => {
    // Arrange
    const { initToneSelect } = await import('../src/tone-select')
    mockApi()
    const select = mountSelect()
    const onError = vi.fn()
    await initToneSelect(select, { onChange: vi.fn().mockRejectedValue(new Error('LLM model not downloaded')), onError })

    // Act
    choose(select, 'academic')

    // Assert
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('LLM model not downloaded'))
  })
})

describe('recommendedModels()', () => {
  it.each([
    ['whisper', 8 * 2 ** 30],
    ['whisper', 16 * 2 ** 30],
    ['llm', 8 * 2 ** 30],
  ] as const)('recommends three %s models from the catalog for %s bytes of RAM', (kind, totalMemBytes) => {
    // Act
    const files = recommendedModels(kind, totalMemBytes)

    // Assert
    expect(files).toHaveLength(3)
    expect(files.map(file => findCatalogModel(file)?.kind)).toEqual([kind, kind, kind])
  })

  it('recommends larger whisper models when there is more RAM', () => {
    // Act
    const small = recommendedModels('whisper', 8 * 2 ** 30)
    const roomy = recommendedModels('whisper', 16 * 2 ** 30)

    // Assert
    expect(roomy).toContain('ggml-large-v3.bin')
    expect(small).not.toContain('ggml-large-v3.bin')
  })
})

describe('shortcuts on Windows', () => {
  it('records the Windows key as Super, which Electron accepts there', () => {
    // Arrange
    const event = key('Space', { metaKey: true, shiftKey: true })

    // Act
    const accelerator = eventToAccelerator(event, false)

    // Assert
    expect(accelerator).toBe('Super+Shift+Space')
  })

  it('labels modifiers with words instead of macOS symbols', () => {
    // Act
    const labels = acceleratorToLabels('CommandOrControl+Shift+Space', false)

    // Assert
    expect(labels).toEqual(['Ctrl', 'Shift', 'Espacio'])
  })

  it('names the modifiers in the hint', () => {
    // Act
    const hint = modifierHint(false)

    // Assert
    expect(hint).toBe('Ctrl, Alt, Shift o Win')
  })
})

describe('isServerProcess()', () => {
  it.each([
    ['"server.exe","4321","Console","1","52,100 K"', true],
    ['"notepad.exe","4321","Console","1","8,000 K"', false],
    ['"server.exe","99","Console","1","52,100 K"', false],
    ['INFO: No tasks are running which match the specified criteria.', false],
  ])('%s -> %s', (tasklistOutput, expected) => {
    // Act
    const found = isServerProcess(tasklistOutput, 4321)

    // Assert
    expect(found).toBe(expected)
  })
})

describe('resolveAppFile()', () => {
  const root = resolve('/app/dist')

  it('maps a page URL to a file inside the build folder', () => {
    // Act
    const file = resolveAppFile(root, 'app://vocalfix/pages/settings.html')

    // Assert
    expect(file).toBe(join(root, 'pages', 'settings.html'))
  })

  it('refuses URLs that escape the build folder', () => {
    // Act
    const file = resolveAppFile(root, 'app://vocalfix/..%2f..%2fetc%2fpasswd')

    // Assert
    expect(file).toBeNull()
  })
})

describe('downloadModel() retries', () => {
  const model = { ...WHISPER_MODELS[0], file: 'test-model.bin', sizeBytes: 10 }
  const fast = { retryDelayMs: 1, stallTimeoutMs: 200 }
  const newDir = () => mkdtempSync(join(tmpdir(), 'vocalfix-download-'))

  // A response whose connection drops after sending `sent`
  function broken(sent: string) {
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sent))
        // Fail once those bytes have reached the disk
        setTimeout(() => controller.error(new Error('connection reset')), 30)
      },
    }))
  }

  it('continues from the bytes already received after a dropped connection', async () => {
    // Arrange
    const dir = newDir()
    const fetch = vi.fn()
      .mockResolvedValueOnce(broken('01234'))
      .mockResolvedValueOnce(new Response('56789', { status: 206 }))

    // Act
    await downloadModel(model, dir, vi.fn(), { ...fast, fetch })

    // Assert
    expect(readFileSync(join(dir, model.file), 'utf-8')).toBe('0123456789')
    expect(fetch.mock.calls[1][1].headers).toEqual({ Range: 'bytes=5-' })
  })

  it('starts over when the server ignores the resume request', async () => {
    // Arrange
    const dir = newDir()
    const fetch = vi.fn()
      .mockResolvedValueOnce(broken('01234'))
      .mockResolvedValueOnce(new Response('0123456789', { status: 200 }))

    // Act
    await downloadModel(model, dir, vi.fn(), { ...fast, fetch })

    // Assert
    expect(readFileSync(join(dir, model.file), 'utf-8')).toBe('0123456789')
  })

  it('gives up after the last attempt and leaves no partial file', async () => {
    // Arrange
    const dir = newDir()
    const fetch = vi.fn().mockRejectedValue(new Error('network down'))

    // Act
    const result = downloadModel(model, dir, vi.fn(), { ...fast, fetch, maxAttempts: 3 })

    // Assert
    await expect(result).rejects.toThrow('network down')
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(readdirSync(dir)).toEqual([])
  })

  it('does not retry a file that does not exist', async () => {
    // Arrange
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 404, statusText: 'Not Found' }))

    // Act
    const result = downloadModel(model, newDir(), vi.fn(), { ...fast, fetch })

    // Assert
    await expect(result).rejects.toThrow('Descarga fallida (404 Not Found)')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries a connection that stops sending data', async () => {
    // Arrange
    const dir = newDir()
    const stalled = (_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason))
    })
    const fetch = vi.fn().mockImplementationOnce(stalled).mockResolvedValueOnce(new Response('0123456789'))

    // Act
    await downloadModel(model, dir, vi.fn(), { ...fast, fetch, stallTimeoutMs: 30 })

    // Assert
    expect(readFileSync(join(dir, model.file), 'utf-8')).toBe('0123456789')
  })
})

describe('custom prompts', () => {
  const custom = sanitizeSettings({ prompts: { grammar: '  Corrige solo la ortografía.  ', natural: '' } })

  it('keeps the trimmed text and falls back to the built-in one when empty', () => {
    // Assert
    expect(custom.prompts).toEqual({ grammar: 'Corrige solo la ortografía.', natural: '' })
    expect(buildSystemPrompt(custom)).toContain(DEFAULT_PROMPTS.natural)
  })

  it('replaces the built-in instructions and still appends the rules', () => {
    // Act
    const prompt = buildGrammarPrompt(custom)

    // Assert
    expect(prompt.startsWith('Corrige solo la ortografía.')).toBe(true)
    expect(prompt).not.toContain(DEFAULT_PROMPTS.grammar)
    expect(prompt).toContain('Remove filler words')
  })

  it('uses the built-in examples only with the built-in instructions', () => {
    // Act
    const withCustom = promptExamples('grammar', custom)
    const withDefault = promptExamples('natural', custom)

    // Assert
    expect(withCustom).toEqual([])
    expect(withDefault.length).toBeGreaterThan(0)
    expect(withDefault.every(example => example.transcript.startsWith('Transcript in '))).toBe(true)
  })

  it.each([
    ['What is the capital of France?', 'Transcript in English: What is the capital of France?'],
    ['¿Dónde está la oficina?', 'Transcript in Spanish: ¿Dónde está la oficina?'],
  ])('labels %j as a transcript in its language', (text, expected) => {
    // Act
    const wrapped = wrapTranscript(text)

    // Assert
    expect(wrapped).toBe(expected)
  })
})
