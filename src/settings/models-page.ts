import type { ModelKind } from '../../electron/modelCatalog'
import { DEFAULT_TEMPERATURE, type AppSettings, type Intervention } from '../../electron/settingsSchema'
import type { ModelCatalogResponse, ModelStatus } from '../global'
import { byId, errorMessage, escapeHtml, formatBytes, memoryFit, showStatus, type MemoryFit } from './shared'

const INTERVENTION_ACTIVE = 'bg-surface-container-high text-primary'
const INTERVENTION_IDLE = 'bg-surface-container text-on-surface-variant hover:text-on-surface'

let catalog: ModelCatalogResponse | null = null
let settings: AppSettings | null = null
const busyFiles = new Set<string>()

function modelLabel(model: ModelStatus): string {
  return model.englishOnly && model.kind === 'whisper' ? `${model.name} (EN)` : model.name
}

function renderAction(model: ModelStatus): string {
  if (model.active && model.downloaded) {
    return '<span class="material-symbols-outlined text-[18px] text-primary">check</span>'
  }
  if (model.progress) {
    const pct = Math.floor((model.progress.received / model.progress.total) * 100)
    return `<span class="font-label-xs text-label-xs text-primary tabular-nums">${pct}%</span>`
  }
  if (busyFiles.has(model.file)) {
    return '<span class="font-label-xs text-label-xs text-outline">Cargando…</span>'
  }
  if (model.downloaded) {
    return `<button type="button" data-action="activate" data-file="${escapeHtml(model.file)}"
      class="px-3 py-1 rounded bg-surface-container-highest hover:bg-surface-bright text-on-surface-variant hover:text-on-surface font-label-xs text-label-xs transition-colors">Activar</button>`
  }
  return `<button type="button" data-action="download" data-file="${escapeHtml(model.file)}"
    class="px-2.5 py-1 rounded bg-surface-container-highest text-primary hover:bg-primary hover:text-on-primary font-label-xs text-label-xs transition-colors flex items-center gap-1">
      <span class="material-symbols-outlined text-[13px]">download</span><span>Descargar</span>
    </button>`
}

const FIT_CHIPS: Record<MemoryFit, { label: string, classes: string, title: string }> = {
  light: { label: 'Fluido', classes: 'text-secondary bg-secondary-container/40', title: 'Usa menos del 25% de la RAM de tu equipo' },
  ok: { label: 'Aceptable', classes: 'text-primary bg-primary/10', title: 'Usa entre el 25% y el 50% de la RAM de tu equipo' },
  heavy: { label: 'Exigente', classes: 'text-error bg-error-container/30', title: 'Usa más de la mitad de la RAM de tu equipo: puede ralentizar el sistema' },
}

function renderSpecs(model: ModelStatus): string {
  const specs: string[] = []
  if (model.sizeBytes) {
    specs.push(`<span class="flex items-center gap-1" title="Espacio en disco">
      <span class="material-symbols-outlined text-[13px]">hard_drive</span>Disco ${formatBytes(model.sizeBytes)}</span>`)
  }
  if (model.ramBytes) {
    specs.push(`<span class="flex items-center gap-1" title="Memoria RAM aproximada mientras está cargado">
      <span class="material-symbols-outlined text-[13px]">memory</span>RAM ~${formatBytes(model.ramBytes)}</span>`)
  }
  const fit = memoryFit(model.ramBytes, catalog?.totalMemBytes ?? 0)
  if (fit) {
    const chip = FIT_CHIPS[fit]
    specs.push(`<span class="px-1.5 rounded ${chip.classes}" title="${chip.title}">${chip.label}</span>`)
  }
  return specs.join('')
}

function renderCard(model: ModelStatus): string {
  const selected = model.active && model.downloaded
  const badges = [
    model.englishOnly ? '<span class="px-1.5 rounded bg-surface-container-highest text-outline font-label-xs text-label-xs">Solo inglés</span>' : '',
    selected ? '<span class="px-1.5 rounded bg-secondary-container/50 text-secondary font-label-xs text-label-xs">En uso</span>' : '',
    model.downloaded && !selected ? '<span class="px-1.5 rounded bg-surface-container-highest text-on-surface-variant font-label-xs text-label-xs">Descargado</span>' : '',
  ].join('')
  const progressBar = model.progress
    ? `<div class="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
         <div class="h-full bg-primary rounded-full" style="width:${(model.progress.received / model.progress.total) * 100}%"></div>
       </div>`
    : ''

  return `
    <div class="p-3 rounded flex flex-col gap-2 ${selected ? 'bg-surface-container-high border border-primary/50 shadow-sm' : 'bg-surface-container border border-transparent'}">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2 flex-wrap min-w-0 pt-0.5">
          <span class="font-body-sm text-body-sm font-medium text-on-surface break-all">${escapeHtml(model.name)}</span>${badges}
        </div>
        <div class="shrink-0">${renderAction(model)}</div>
      </div>
      <p class="font-label-xs text-label-xs text-on-surface-variant">${escapeHtml(model.note)}</p>
      <div class="mt-auto flex items-center gap-3 flex-wrap font-label-xs text-label-xs text-outline">${renderSpecs(model)}</div>
      ${progressBar}
    </div>`
}

function renderSystemMemory() {
  const el = byId('system-memory')
  if (!el || !catalog?.totalMemBytes) return
  // RAM is sold in binary units: 8 GiB reports 8.59e9 bytes but is "8 GB"
  el.textContent = `Tu equipo tiene ${Math.round(catalog.totalMemBytes / 2 ** 30)} GB de RAM. ` +
    'Fluido: menos del 25% · Aceptable: hasta el 50% · Exigente: más de la mitad. ' +
    'Whisper y el motor lingüístico pueden estar cargados a la vez.'
}

function renderActiveBadge(el: HTMLElement | null, models: ModelStatus[]) {
  if (!el) return
  const active = models.find(m => m.active && m.downloaded)
  el.className = `font-label-xs text-label-xs flex items-center gap-1.5 px-2 py-0.5 rounded shrink-0 ${
    active ? 'text-secondary bg-secondary-container/40' : 'text-error bg-error-container/30'}`
  el.innerHTML = active
    ? `<span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>${escapeHtml(modelLabel(active))}`
    : '<span class="w-1.5 h-1.5 rounded-full bg-error"></span>Sin modelo descargado'
}

function renderLanguageWarning() {
  const warning = byId('whisper-language-warning')
  if (!warning || !catalog || !settings) return
  const active = catalog.whisper.find(m => m.active && m.downloaded)
  warning.classList.toggle('hidden', !(active?.englishOnly && settings.language !== 'en'))
}

function renderCatalog() {
  if (!catalog) return
  const whisperGrid = byId('whisper-grid')
  const llmGrid = byId('llm-grid')
  if (whisperGrid) whisperGrid.innerHTML = catalog.whisper.map(renderCard).join('')
  if (llmGrid) llmGrid.innerHTML = catalog.llm.map(renderCard).join('')
  renderActiveBadge(byId('whisper-active-badge'), catalog.whisper)
  renderActiveBadge(byId('llm-active-badge'), catalog.llm)
  renderLanguageWarning()
  renderSystemMemory()
}

function renderLlmParams() {
  if (!settings) return
  document.querySelectorAll<HTMLButtonElement>('[data-intervention]').forEach(btn => {
    const active = btn.dataset.intervention === settings!.intervention
    btn.className = `px-2 py-0.5 rounded font-label-xs text-label-xs transition-colors ${active ? INTERVENTION_ACTIVE : INTERVENTION_IDLE}`
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
  if (pathValue) {
    pathValue.textContent = catalog.modelsDir
    pathValue.title = catalog.modelsDir
  }
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

function findModel(file: string): ModelStatus | undefined {
  return catalog ? [...catalog.whisper, ...catalog.llm].find(m => m.file === file) : undefined
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

async function download(model: ModelStatus) {
  try {
    await window.electronAPI.downloadModel(model.file)
    await refreshCatalog()
    // First model of its kind: make it active right away
    const list = model.kind === 'whisper' ? catalog!.whisper : catalog!.llm
    if (!list.some(m => m.active && m.downloaded)) await activate(model.kind, model.file)
    else showStatus(`${model.name} descargado`)
  } catch (e) {
    showStatus(errorMessage(e), 'error')
    await refreshCatalog()
  }
}

function onGridClick(event: Event) {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
  const model = button && findModel(button.dataset.file ?? '')
  if (!button || !model) return

  if (button.dataset.action === 'download') {
    model.progress = { received: 0, total: model.sizeBytes || 1 }
    renderCatalog()
    void download(model)
  } else if (button.dataset.action === 'activate') {
    void activate(model.kind, model.file)
  }
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

  byId('whisper-grid')?.addEventListener('click', onGridClick)
  byId('llm-grid')?.addEventListener('click', onGridClick)

  api.onModelDownloadProgress(progress => {
    const model = findModel(progress.file)
    if (!model) return
    model.progress = { received: progress.received, total: progress.total || 1 }
    renderCatalog()
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
