// Shared UI pieces for every settings page.

export const SETTINGS_SECTIONS = [
  { path: 'modelos-locales', label: 'Modelos Locales', icon: 'memory' },
  { path: 'reglas-gramaticales-estilo', label: 'Reglas Gramaticales & Estilo', icon: 'spellcheck' },
  { path: 'atajos-teclado-hotkeys', label: 'Atajos de Teclado', icon: 'keyboard' },
] as const

const ACTIVE_ITEM = 'bg-surface-container-high text-on-surface shadow-sm'
const IDLE_ITEM = 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Renders the sidebar into <nav id="settings-nav" data-active="...">. Must run before initNavigation().
export function renderSettingsNav(nav: HTMLElement) {
  const activePath = nav.dataset.active
  nav.innerHTML = SETTINGS_SECTIONS.map(({ path, label, icon }) => {
    const active = path === activePath
    return `
      <button type="button" data-path="${path}" ${active ? 'aria-current="page"' : ''}
        class="w-full flex items-center justify-between px-3 py-2 rounded font-body-sm text-body-sm text-left group ${active ? ACTIVE_ITEM : IDLE_ITEM}">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-[17px] ${active ? 'text-primary' : 'text-outline'}">${icon}</span>
          <span class="${active ? 'font-medium' : ''}">${escapeHtml(label)}</span>
        </div>
        <span class="material-symbols-outlined text-[14px] ${active ? 'text-primary' : 'opacity-0 group-hover:opacity-100 text-outline transition-opacity'}">chevron_right</span>
      </button>`
  }).join('')
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  return `${Math.round(bytes / 1e6)} MB`
}

export type MemoryFit = 'light' | 'ok' | 'heavy'

// How demanding a model is relative to this machine's RAM. The OS, the browser and
// the other loaded model share that memory, so a quarter is comfortable and half is the limit.
export function memoryFit(ramBytes: number, totalMemBytes: number): MemoryFit | null {
  if (!ramBytes || !totalMemBytes) return null
  const share = ramBytes / totalMemBytes
  if (share <= 0.25) return 'light'
  if (share <= 0.5) return 'ok'
  return 'heavy'
}

let statusTimer: ReturnType<typeof setTimeout> | undefined

// Shows a transient message in #settings-status (errors stay until the next message).
export function showStatus(message: string, kind: 'ok' | 'error' = 'ok') {
  const el = document.getElementById('settings-status')
  if (!el) return
  el.textContent = message
  el.classList.remove('hidden', 'text-secondary', 'text-error')
  el.classList.add(kind === 'ok' ? 'text-secondary' : 'text-error')
  clearTimeout(statusTimer)
  if (kind === 'ok') statusTimer = setTimeout(() => el.classList.add('hidden'), 2000)
}

export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  // ipcRenderer.invoke prefixes "Error invoking remote method '...': Error: "
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
