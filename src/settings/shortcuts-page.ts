import { acceleratorToLabels, eventToAccelerator, modifierHint } from './accelerator'
import { byId, errorMessage, escapeHtml, showStatus } from './shared'

let currentShortcut = ''
let capturing = false

const actionButton = (action: string, label: string, extra = '') =>
  `<button type="button" data-action="${action}" class="vf-btn-text ${extra}">${label}</button>`

// The global shortcut cell: its keys, the capture prompt, or "disabled"
function render() {
  const cell = byId('record-shortcut')
  if (!cell) return
  if (capturing) {
    cell.innerHTML = '<span class="text-xs text-[#f0c88e] border border-dashed border-[#6a5530] rounded-[5px] px-2.5 py-[3px]">Pulsa la combinación…</span>' +
      actionButton('cancel', 'Cancelar', 'text-vf-dim')
    return
  }
  const labels = acceleratorToLabels(currentShortcut)
  if (labels.length === 0) {
    cell.innerHTML = '<span class="text-xs text-vf-faint">Desactivado</span>' + actionButton('change', 'Asignar')
    return
  }
  const keys = labels
    .map(label => `<kbd class="vf-kbd text-[11.5px] text-vf-ink border-vf-stroke">${escapeHtml(label)}</kbd>`)
    .join('')
  cell.innerHTML = `<div class="flex gap-[3px]">${keys}</div>` +
    actionButton('change', 'Cambiar') + actionButton('disable', 'Desactivar', 'text-vf-faint')
}

function setCapturing(active: boolean) {
  capturing = active
  render()
}

async function applyShortcut(accelerator: string) {
  try {
    const { ok, settings } = await window.electronAPI.setRecordShortcut(accelerator)
    currentShortcut = settings.recordShortcut
    render()
    if (ok) showStatus(accelerator ? 'Atajo actualizado' : 'Atajo desactivado')
    else showStatus('Esa combinación no está disponible (inválida o en uso por otra app)', 'error')
  } catch (e) {
    showStatus(errorMessage(e), 'error')
  }
}

export async function initShortcutsPage() {
  const hint = byId('modifier-hint')
  if (hint) hint.textContent = modifierHint()

  byId('record-shortcut')?.addEventListener('click', event => {
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')?.dataset.action
    if (action === 'change') setCapturing(true)
    else if (action === 'cancel') setCapturing(false)
    else if (action === 'disable') void applyShortcut('')
  })

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
    render()
  } catch (e) {
    showStatus(errorMessage(e), 'error')
  }
}
