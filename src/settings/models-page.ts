import { recommendedModels, type ModelKind } from '../../electron/modelCatalog'
import { DEFAULT_TEMPERATURE, type AppSettings, type Intervention } from '../../electron/settingsSchema'
import type { ModelCatalogResponse, ModelStatus } from '../global'
import { byId, errorMessage, escapeHtml, formatBytes, memoryFit, showStatus, type MemoryFit } from './shared'

// A model family is one model in up to two variants: multilingual and English-only.
type Variant = 'multi' | 'en'

interface Family {
  name: string
  variants: Partial<Record<Variant, ModelStatus>>
}

const KINDS: ModelKind[] = ['whisper', 'llm']
const TIERS = ['Rápido', 'Equilibrado', 'Máxima calidad']
const FIT_LABELS: Record<MemoryFit, string> = { ok: 'Aceptable', heavy: 'Exigente' }

const SEGMENT = 'rounded px-2 py-[3px] text-[11px] cursor-pointer transition-colors'
const SEGMENT_ACTIVE = 'bg-vf-chip text-vf-ink'
const SEGMENT_IDLE = 'text-vf-low hover:text-vf-ink'

let catalog: ModelCatalogResponse | null = null
let settings: AppSettings | null = null
const busyFiles = new Set<string>()
// Variant picked with the Multi/EN switch, by family name
const pickedVariants = new Map<string, Variant>()

const isInUse = (model: ModelStatus) => model.active && model.downloaded
const variantOf = (model: ModelStatus): Variant => (model.englishOnly ? 'en' : 'multi')
const modelsOf = (kind: ModelKind) => (catalog ? (kind === 'whisper' ? catalog.whisper : catalog.llm) : [])

function families(kind: ModelKind): Family[] {
  const byName = new Map<string, Family>()
  for (const model of modelsOf(kind)) {
    const family = byName.get(model.name) ?? { name: model.name, variants: {} }
    family.variants[variantOf(model)] = model
    byName.set(model.name, family)
  }
  return [...byName.values()]
}

// The variant shown for a family: the one picked, else the one in use, else multilingual
function shown(family: Family): ModelStatus {
  const { multi, en } = family.variants
  const picked = pickedVariants.get(family.name)
  if (picked && family.variants[picked]) return family.variants[picked]
  if (en && isInUse(en)) return en
  return (multi ?? en)!
}

function findModel(file: string): ModelStatus | undefined {
  return catalog ? [...catalog.whisper, ...catalog.llm].find(m => m.file === file) : undefined
}

const progressPercent = (model: ModelStatus) =>
  `${model.progress ? Math.floor((model.progress.received / model.progress.total) * 100) : 0}%`

function renderStatus(model: ModelStatus): string {
  if (isInUse(model)) return '<span class="text-xs text-vf-green">En uso</span>'
  if (model.progress) {
    const percent = progressPercent(model)
    return `<div data-progress-file="${escapeHtml(model.file)}" class="flex items-center gap-2">
      <div class="w-14 h-[3px] rounded-sm bg-vf-key overflow-hidden"><div data-bar class="h-full bg-vf-amber" style="width:${percent}"></div></div>
      <span data-percent class="font-mono text-[11px] text-vf-dim tabular-nums">${percent}</span>
    </div>`
  }
  if (busyFiles.has(model.file)) return '<span class="text-xs text-vf-dim">Cargando…</span>'
  const file = escapeHtml(model.file)
  return model.downloaded
    ? `<button type="button" data-action="activate" data-file="${file}" class="vf-btn-solid">Activar</button>`
    : `<button type="button" data-action="download" data-file="${file}" class="vf-btn">Descargar</button>`
}

function renderFit(model: ModelStatus): string {
  const fit = memoryFit(model.ramBytes, catalog?.totalMemBytes ?? 0)
  return fit ? `<span class="text-vf-amber">· ${FIT_LABELS[fit]}</span>` : ''
}

function renderActive(kind: ModelKind): string {
  const active = modelsOf(kind).find(isInUse)
  if (!active) {
    return `<div class="vf-label text-vf-amber">Sin modelo</div>
      <div class="text-[13px] text-vf-dim">Descarga uno de los recomendados para empezar.</div>`
  }
  const specs = [
    active.sizeBytes ? `Disco ${formatBytes(active.sizeBytes)}` : '',
    active.ramBytes ? `RAM ~${formatBytes(active.ramBytes)}` : '',
  ].filter(Boolean).join(' · ')
  return `<div class="vf-label text-vf-green flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-vf-green"></span>En uso</div>
    <div class="flex items-baseline gap-2 flex-wrap">
      <span class="text-[17px] font-medium break-all">${escapeHtml(active.name)}</span>
      ${active.englishOnly ? '<span class="text-xs text-vf-dim">Solo inglés</span>' : ''}
    </div>
    <div class="font-mono text-[11.5px] text-vf-faint">${specs}</div>`
}

function renderRecommendation(family: Family, tier: string): string {
  const model = shown(family)
  const englishVariant = model.englishOnly && family.variants.multi
  return `<div class="bg-vf-rail border ${isInUse(model) ? 'border-[#6a5530]' : 'border-vf-rim'} rounded-[10px] px-4 py-3.5 flex flex-col gap-2.5">
    <div class="text-[11.5px] font-medium text-vf-amber">${tier}</div>
    <div class="flex flex-col gap-[3px] flex-1">
      <div class="text-sm font-medium">${escapeHtml(model.name)}${englishVariant ? ' (EN)' : ''}</div>
      <div class="text-xs text-vf-dim">${escapeHtml(model.note)}</div>
    </div>
    <div class="flex items-center justify-between gap-2 min-h-7">
      <div class="flex items-center gap-1.5 font-mono text-[11px] text-vf-faint">${formatBytes(model.sizeBytes)}${renderFit(model)}</div>
      ${renderStatus(model)}
    </div>
  </div>`
}

function renderVariantSwitch(family: Family, current: Variant): string {
  if (!family.variants.multi || !family.variants.en) return ''
  const segment = (variant: Variant, label: string) =>
    `<button type="button" data-action="variant" data-family="${escapeHtml(family.name)}" data-variant="${variant}"
      class="${SEGMENT} ${variant === current ? SEGMENT_ACTIVE : SEGMENT_IDLE}">${label}</button>`
  return `<div class="flex p-0.5 gap-0.5 bg-[#141416] border border-vf-rim rounded-md" title="Multilingüe o solo inglés">
    ${segment('multi', 'Multi')}${segment('en', 'EN')}
  </div>`
}

function renderRow(family: Family): string {
  const model = shown(family)
  const specs = [
    model.sizeBytes ? formatBytes(model.sizeBytes) : '',
    model.ramBytes ? `RAM ~${formatBytes(model.ramBytes)}` : '',
  ].filter(Boolean).join(' · ')
  return `<div class="flex items-center gap-4 flex-wrap px-4 py-3 ${isInUse(model) ? 'bg-[#1d1f1c]' : 'bg-vf-rail'}">
    <div class="flex-1 min-w-[200px] flex flex-col gap-0.5">
      <div class="flex items-center gap-2 text-[13.5px]">
        <span class="break-all">${escapeHtml(model.name)}</span>
        ${family.variants.multi ? '' : '<span class="text-[11px] text-vf-dim shrink-0">Solo inglés</span>'}
      </div>
      <div class="text-xs text-vf-low">${escapeHtml(model.note)}</div>
    </div>
    ${renderVariantSwitch(family, variantOf(model))}
    <div class="flex items-center justify-end gap-1.5 min-w-[150px] font-mono text-[11px] text-vf-faint">${specs}${renderFit(model)}</div>
    <div class="w-[92px] flex justify-end">${renderStatus(model)}</div>
  </div>`
}

// English-only whisper model with another dictation language: offer the multilingual variant
function renderLanguageWarning() {
  const warning = byId('whisper-warning')
  if (!warning || !catalog || !settings) return
  const active = catalog.whisper.find(isInUse)
  const needed = Boolean(active?.englishOnly) && settings.language !== 'en'
  warning.classList.toggle('hidden', !needed)
  warning.classList.toggle('flex', needed)
  if (!active || !needed) return

  const multilingual = families('whisper').find(f => f.variants.en === active)?.variants.multi
  const fix = multilingual && !multilingual.progress && !busyFiles.has(multilingual.file)
    ? `<button type="button" data-action="${multilingual.downloaded ? 'activate' : 'download-activate'}" data-file="${escapeHtml(multilingual.file)}"
        class="bg-vf-amber text-[#1a1408] rounded-md px-3 py-1.5 text-[12.5px] font-medium cursor-pointer">
        ${multilingual.downloaded ? 'Usar multilingüe' : `Descargar multilingüe · ${formatBytes(multilingual.sizeBytes)}`}</button>`
    : ''
  warning.innerHTML = `<span class="flex-1 min-w-[200px] text-[12.5px] text-[#f0c88e]">${escapeHtml(active.name)} solo transcribe inglés. Para dictar en otro idioma necesitas la versión multilingüe.</span>${fix}`
}

function renderKind(kind: ModelKind) {
  if (!catalog) return
  const all = families(kind)
  const recommended = recommendedModels(kind, catalog.totalMemBytes)
    .map(file => all.find(f => Object.values(f.variants).some(m => m.file === file)))

  const active = byId(`${kind}-active`)
  const recs = byId(`${kind}-recs`)
  const rows = byId(`${kind}-rows`)
  const count = byId(`${kind}-count`)
  if (active) active.innerHTML = renderActive(kind)
  if (recs) recs.innerHTML = recommended.map((family, i) => (family ? renderRecommendation(family, TIERS[i]) : '')).join('')
  if (rows) rows.innerHTML = all.map(renderRow).join('')
  if (count) count.textContent = String(all.length)
}

function renderCatalog() {
  if (!catalog) return
  KINDS.forEach(renderKind)
  renderLanguageWarning()
  const memory = byId('system-memory')
  if (memory && catalog.totalMemBytes) {
    // RAM is sold in binary units: 8 GiB reports 8.59e9 bytes but is "8 GB"
    memory.textContent = 'Todo se procesa en tu equipo. Recomendaciones ajustadas a ' +
      `${Math.round(catalog.totalMemBytes / 2 ** 30)} GB de RAM.`
  }
}

// Download progress arrives several times a second: update the bars in place, because
// re-rendering the lists would swallow clicks on the other models' buttons.
function renderProgress(model: ModelStatus) {
  const percent = progressPercent(model)
  const indicators = [...document.querySelectorAll<HTMLElement>('[data-progress-file]')]
    .filter(el => el.dataset.progressFile === model.file)
  if (indicators.length === 0) return renderCatalog()
  for (const indicator of indicators) {
    const bar = indicator.querySelector<HTMLElement>('[data-bar]')
    const label = indicator.querySelector('[data-percent]')
    if (bar) bar.style.width = percent
    if (label) label.textContent = percent
  }
}

function renderLlmParams() {
  if (!settings) return
  document.querySelectorAll<HTMLButtonElement>('[data-intervention]').forEach(btn => {
    const active = btn.dataset.intervention === settings!.intervention
    btn.className = `${SEGMENT} ${active ? SEGMENT_ACTIVE : SEGMENT_IDLE}`
    btn.setAttribute('aria-pressed', String(active))
  })
  const slider = byId<HTMLInputElement>('llm-temperature')
  const value = byId('llm-temperature-value')
  if (slider) slider.value = String(settings.temperature)
  if (value) value.textContent = settings.temperature.toFixed(2)
}

async function refreshCatalog() {
  catalog = await window.electronAPI.getModelCatalog()
  const pathValue = byId('models-path-value')
  if (pathValue) pathValue.textContent = catalog.modelsDir
  renderCatalog()
}

async function saveSettings(patch: Partial<AppSettings>) {
  try {
    settings = await window.electronAPI.updateSettings(patch)
    showStatus('Guardado')
  } catch (e) {
    showStatus(errorMessage(e), 'error')
  }
}

async function activate(kind: ModelKind, file: string) {
  busyFiles.add(file)
  renderCatalog()
  try {
    settings = await window.electronAPI.activateModel(kind, file)
    showStatus('Modelo activado')
  } catch (e) {
    showStatus(errorMessage(e), 'error')
  } finally {
    busyFiles.delete(file)
    await refreshCatalog()
  }
}

async function download(model: ModelStatus, activateAfter: boolean) {
  model.progress = { received: 0, total: model.sizeBytes || 1 }
  renderCatalog()
  try {
    await window.electronAPI.downloadModel(model.file)
    await refreshCatalog()
    // The first model of its kind becomes the active one right away
    if (activateAfter || !modelsOf(model.kind).some(isInUse)) await activate(model.kind, model.file)
    else showStatus(`${model.name} descargado`)
  } catch (e) {
    showStatus(errorMessage(e), 'error')
    await refreshCatalog()
  }
}

function onModelClick(event: Event) {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
  if (!button) return
  const { action, file = '', family, variant } = button.dataset

  if (action === 'variant' && family) {
    pickedVariants.set(family, variant as Variant)
    renderCatalog()
    return
  }
  const model = findModel(file)
  if (!model) return
  if (action === 'activate') void activate(model.kind, model.file)
  else if (action === 'download') void download(model, false)
  else if (action === 'download-activate') void download(model, true)
}

export async function initModelsPage() {
  const api = window.electronAPI

  byId('models-path-pick')?.addEventListener('click', async () => {
    try {
      if (await api.selectModelsPath()) {
        await refreshCatalog()
        showStatus('Carpeta de modelos actualizada')
      }
    } catch (e) {
      showStatus(errorMessage(e), 'error')
    }
  })

  document.querySelector('main')?.addEventListener('click', onModelClick)

  api.onModelDownloadProgress(progress => {
    const model = findModel(progress.file)
    if (!model) return
    model.progress = { received: progress.received, total: progress.total || 1 }
    renderProgress(model)
  })

  const language = byId<HTMLSelectElement>('whisper-language')
  language?.addEventListener('change', async () => {
    await saveSettings({ language: language.value as AppSettings['language'] })
    renderLanguageWarning()
  })

  document.querySelectorAll<HTMLButtonElement>('[data-intervention]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const intervention = btn.dataset.intervention as Intervention
      await saveSettings({ intervention, temperature: DEFAULT_TEMPERATURE[intervention] })
      renderLlmParams()
    })
  })

  const slider = byId<HTMLInputElement>('llm-temperature')
  slider?.addEventListener('input', () => {
    const value = byId('llm-temperature-value')
    if (value) value.textContent = Number(slider.value).toFixed(2)
  })
  slider?.addEventListener('change', () => saveSettings({ temperature: Number(slider.value) }))

  try {
    settings = await api.getSettings()
    if (language) language.value = settings.language
    renderLlmParams()
    await refreshCatalog()
  } catch (e) {
    const pathValue = byId('models-path-value')
    if (pathValue) pathValue.textContent = 'No disponible'
    showStatus(errorMessage(e), 'error')
  }
}
