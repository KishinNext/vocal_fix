// Shared UI pieces for every settings page.

export const SETTINGS_SECTIONS = [
  { path: 'modelos-locales', label: 'Modelos Locales' },
  { path: 'reglas-gramaticales-estilo', label: 'Reglas Gramaticales & Estilo' },
  { path: 'atajos-teclado-hotkeys', label: 'Atajos de Teclado' },
] as const

const NAV_ITEM = 'text-left px-3 py-2 text-[13px] rounded-md cursor-pointer transition-colors'
const ACTIVE_ITEM = 'bg-vf-raised text-vf-ink'
const IDLE_ITEM = 'text-vf-mute hover:text-vf-ink'

export function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null
}

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
  nav.innerHTML = SETTINGS_SECTIONS.map(({ path, label }) => {
    const active = path === activePath
    return `<button type="button" data-path="${path}" ${active ? 'aria-current="page"' : ''}
      class="${NAV_ITEM} ${active ? ACTIVE_ITEM : IDLE_ITEM}">${escapeHtml(label)}</button>`
  }).join('')
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  return `${Math.round(bytes / 1e6)} MB`
}

export type MemoryFit = 'ok' | 'heavy'

// How demanding a model is relative to this machine's RAM. The OS, the browser and the
// other loaded model share that memory: under 30% needs no warning and half is the limit.
export function memoryFit(ramBytes: number, totalMemBytes: number): MemoryFit | null {
  if (!ramBytes || !totalMemBytes) return null
  const share = ramBytes / totalMemBytes
  if (share < 0.3) return null
  return share <= 0.5 ? 'ok' : 'heavy'
}

let statusTimer: ReturnType<typeof setTimeout> | undefined

// Shows a transient message in #settings-status (errors stay until the next message).
export function showStatus(message: string, kind: 'ok' | 'error' = 'ok') {
  const el = document.getElementById('settings-status')
  if (!el) return
  el.textContent = message
  el.classList.remove('hidden', 'text-vf-green', 'text-vf-red')
  el.classList.add(kind === 'ok' ? 'text-vf-green' : 'text-vf-red')
  clearTimeout(statusTimer)
  if (kind === 'ok') statusTimer = setTimeout(() => el.classList.add('hidden'), 2000)
}

export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  // ipcRenderer.invoke prefixes "Error invoking remote method '...': Error: "
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
