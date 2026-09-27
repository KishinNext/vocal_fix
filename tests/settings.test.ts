/**
 * VocalFix – Settings logic tests (pure modules shared by main and renderer)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DEFAULT_SETTINGS, DEFAULT_TEMPERATURE, sanitizeSettings } from '../electron/settingsSchema'
import { buildSystemPrompt } from '../electron/prompt'
import { LLM_MODELS, WHISPER_MODELS, findCatalogModel, isLlmFile, isWhisperFile, modelDisplayName } from '../electron/modelCatalog'
import { acceleratorToLabels, eventToAccelerator } from '../src/settings/accelerator'
import { SETTINGS_SECTIONS, errorMessage, escapeHtml, formatBytes, memoryFit, renderSettingsNav } from '../src/settings/shared'

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

describe('eventToAccelerator()', () => {
  it('builds an accelerator from modifiers and key', () => {
    expect(eventToAccelerator(key('Space', { metaKey: true, shiftKey: true }))).toBe('Command+Shift+Space')
    expect(eventToAccelerator(key('KeyR', { altKey: true }))).toBe('Alt+R')
    expect(eventToAccelerator(key('Digit1', { ctrlKey: true }))).toBe('Control+1')
    expect(eventToAccelerator(key('F5', { metaKey: true }))).toBe('Command+F5')
  })

  it('returns null while only a modifier is pressed', () => {
    expect(eventToAccelerator(key('ShiftLeft', { shiftKey: true }))).toBeNull()
  })

  it('rejects combos without a modifier', () => {
    expect(eventToAccelerator(key('KeyA'))).toBeNull()
  })

  it('rejects unsupported keys', () => {
    expect(eventToAccelerator(key('IntlBackslash', { metaKey: true }))).toBeNull()
  })
})

describe('acceleratorToLabels()', () => {
  it('maps modifiers to macOS symbols', () => {
    expect(acceleratorToLabels('CommandOrControl+Shift+Space')).toEqual(['⌘', '⇧', 'Espacio'])
    expect(acceleratorToLabels('Alt+R')).toEqual(['⌥', 'R'])
  })

  it('returns no labels for a disabled shortcut', () => {
    expect(acceleratorToLabels('')).toEqual([])
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
    expect(memoryFit(0.8e9, total)).toBe('light')
    expect(memoryFit(4e9, total)).toBe('light')
    expect(memoryFit(4.2e9, total)).toBe('ok')
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

describe('tone tabs', () => {
  function mountTabs() {
    document.body.innerHTML = `
      <div id="tone-tabs">
        <button data-tone="conversational">Natural</button>
        <button data-tone="business">Profesional</button>
        <button data-tone="concise">Conciso</button>
      </div>`
    return document.getElementById('tone-tabs')!
  }

  function mockApi(overrides: Record<string, unknown> = {}) {
    const api = {
      getSettings: vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS, profile: 'business' }),
      updateSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      fixGrammar: vi.fn().mockResolvedValue('Texto breve.'),
      ...overrides,
    }
    ;(window as any).electronAPI = api
    return api
  }

  const selected = (el: HTMLElement) =>
    [...el.querySelectorAll('[aria-selected="true"]')].map(b => (b as HTMLElement).dataset.tone)

  it('highlights the saved profile on load', async () => {
    const { initToneTabs } = await import('../src/tone-tabs')
    mockApi()
    const tabs = mountTabs()
    await initToneTabs(tabs, { getText: () => '', onPending: vi.fn(), onResult: vi.fn(), onError: vi.fn() })
    expect(selected(tabs)).toEqual(['business'])
  })

  it('selects no tab for profiles that only exist in Settings', async () => {
    const { renderToneTabs } = await import('../src/tone-tabs')
    const tabs = mountTabs()
    renderToneTabs(tabs, 'academic')
    expect(selected(tabs)).toEqual([])
  })

  it('saves the profile and re-corrects the last text on click', async () => {
    const { initToneTabs } = await import('../src/tone-tabs')
    const api = mockApi()
    const tabs = mountTabs()
    const onResult = vi.fn()
    await initToneTabs(tabs, { getText: () => 'el texto largo', onPending: vi.fn(), onResult, onError: vi.fn() })

    tabs.querySelector<HTMLButtonElement>('[data-tone="concise"]')!.click()
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith('Texto breve.'))
    expect(api.updateSettings).toHaveBeenCalledWith({ profile: 'concise' })
    expect(api.fixGrammar).toHaveBeenCalledWith('el texto largo')
    expect(selected(tabs)).toEqual(['concise'])
  })

  it('only saves the profile when there is nothing to re-correct', async () => {
    const { initToneTabs } = await import('../src/tone-tabs')
    const api = mockApi()
    const tabs = mountTabs()
    await initToneTabs(tabs, { getText: () => '', onPending: vi.fn(), onResult: vi.fn(), onError: vi.fn() })

    tabs.querySelector<HTMLButtonElement>('[data-tone="conversational"]')!.click()
    await vi.waitFor(() => expect(api.updateSettings).toHaveBeenCalledWith({ profile: 'conversational' }))
    expect(api.fixGrammar).not.toHaveBeenCalled()
  })

  it('ignores a slow result superseded by a later click', async () => {
    const { initToneTabs } = await import('../src/tone-tabs')
    let resolveFirst!: (v: string) => void
    const fixGrammar = vi.fn()
      .mockImplementationOnce(() => new Promise<string>(r => { resolveFirst = r }))
      .mockResolvedValueOnce('segundo')
    mockApi({ fixGrammar })
    const tabs = mountTabs()
    const onResult = vi.fn()
    await initToneTabs(tabs, { getText: () => 'texto', onPending: vi.fn(), onResult, onError: vi.fn() })

    tabs.querySelector<HTMLButtonElement>('[data-tone="business"]')!.click()
    await vi.waitFor(() => expect(fixGrammar).toHaveBeenCalledTimes(1))
    tabs.querySelector<HTMLButtonElement>('[data-tone="concise"]')!.click()
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith('segundo'))
    resolveFirst('primero')
    await new Promise(r => setTimeout(r, 0))
    expect(onResult).not.toHaveBeenCalledWith('primero')
  })

  it('reports errors from the model', async () => {
    const { initToneTabs } = await import('../src/tone-tabs')
    mockApi({ fixGrammar: vi.fn().mockRejectedValue(new Error('LLM model not downloaded')) })
    const tabs = mountTabs()
    const onError = vi.fn()
    await initToneTabs(tabs, { getText: () => 'texto', onPending: vi.fn(), onResult: vi.fn(), onError })

    tabs.querySelector<HTMLButtonElement>('[data-tone="business"]')!.click()
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('LLM model not downloaded'))
  })
})
