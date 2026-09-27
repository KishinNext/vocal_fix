import { acceleratorToLabels, eventToAccelerator } from './accelerator'
import { errorMessage, escapeHtml, showStatus } from './shared'

let currentShortcut = ''
let capturing = false

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null
}

function renderKeys(accelerator: string) {
  const keys = byId('record-shortcut-keys')
  if (!keys) return
  const labels = acceleratorToLabels(accelerator)
  keys.innerHTML = labels.length === 0
    ? '<span class="font-label-xs text-label-xs text-outline">Desactivado</span>'
    : labels.map(label => `<kbd class="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface font-label-xs text-label-xs">${escapeHtml(label)}</kbd>`).join('')
  byId('record-shortcut-disable')?.classList.toggle('hidden', !accelerator)
}

function setCapturing(active: boolean) {
  capturing = active
  const button = byId('record-shortcut-change')
  if (button) button.textContent = active ? 'Presiona la combinación… (Esc cancela)' : 'Cambiar'
  button?.classList.toggle('text-primary', active)
}

async function applyShortcut(accelerator: string) {
  try {
    const { ok, settings } = await window.electronAPI.setRecordShortcut(accelerator)
    currentShortcut = settings.recordShortcut
    renderKeys(currentShortcut)
    if (ok) showStatus(accelerator ? 'Atajo actualizado' : 'Atajo desactivado')
    else showStatus('Esa combinación no está disponible (inválida o en uso por otra app)', 'error')
  } catch (e) {
    showStatus(errorMessage(e), 'error')
  }
}

export async function initShortcutsPage() {
  byId('record-shortcut-change')?.addEventListener('click', () => setCapturing(!capturing))
  byId('record-shortcut-disable')?.addEventListener('click', () => applyShortcut(''))

  window.addEventListener('keydown', event => {
    if (!capturing) return
    event.preventDefault()
    if (event.code === 'Escape') {
      setCapturing(false)
      return
    }
    const accelerator = eventToAccelerator(event)
    if (!accelerator) return // still holding only modifiers, or no modifier used
    setCapturing(false)
    void applyShortcut(accelerator)
  })

  try {
    currentShortcut = (await window.electronAPI.getSettings()).recordShortcut
    renderKeys(currentShortcut)
  } catch (e) {
    showStatus(errorMessage(e), 'error')
  }
}
