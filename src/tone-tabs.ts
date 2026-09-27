import type { Profile } from '../electron/settingsSchema'

// Editor tone tabs are a shortcut for Settings > Reglas > Perfil. Profiles without a tab
// (Académico, ES→EN) leave every tab unselected.

const ACTIVE = ['text-studio-heading', 'font-medium', 'bg-studio-elevated', 'shadow-xs', 'border-white/[0.06]']
const IDLE = ['text-zinc-400', 'hover:text-zinc-200', 'border-transparent']

export function renderToneTabs(container: HTMLElement, profile: Profile) {
  container.querySelectorAll<HTMLButtonElement>('[data-tone]').forEach(tab => {
    const active = tab.dataset.tone === profile
    tab.classList.remove(...ACTIVE, ...IDLE)
    tab.classList.add(...(active ? ACTIVE : IDLE))
    tab.setAttribute('aria-selected', String(active))
  })
}

interface ToneTabsOptions {
  onChange: (profile: Profile) => Promise<void>  // runs after the profile is saved
  onError: (message: string) => void
}

export async function initToneTabs(container: HTMLElement, options: ToneTabsOptions) {
  const api = window.electronAPI

  container.addEventListener('click', async event => {
    const tab = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tone]')
    if (!tab) return
    const profile = tab.dataset.tone as Profile
    renderToneTabs(container, profile)

    try {
      await api.updateSettings({ profile })
      await options.onChange(profile)
    } catch (e) {
      options.onError(e instanceof Error ? e.message : String(e))
    }
  })

  try {
    renderToneTabs(container, (await api.getSettings()).profile)
  } catch (e) {
    console.error('Failed to load tone profile', e)
  }
}
