import type { Profile } from '../electron/settingsSchema'

// The editor's tone dropdown is a shortcut for Settings > Gramática y estilo > Tono.

export const TONE_OPTIONS: { value: Profile, label: string }[] = [
  { value: 'conversational', label: 'Conversacional' },
  { value: 'business', label: 'Negocios' },
  { value: 'academic', label: 'Académico' },
  { value: 'concise', label: 'Conciso' },
  { value: 'es-en', label: 'Español → Inglés' },
]

interface ToneSelectOptions {
  onChange: (profile: Profile) => Promise<void>  // runs after the profile is saved
  onError: (message: string) => void
}

export async function initToneSelect(select: HTMLSelectElement, options: ToneSelectOptions) {
  const api = window.electronAPI

  select.replaceChildren(...TONE_OPTIONS.map(({ value, label }) => {
    const option = document.createElement('option')
    option.value = value
    option.text = label
    return option
  }))

  select.addEventListener('change', async () => {
    const profile = select.value as Profile
    try {
      await api.updateSettings({ profile })
      await options.onChange(profile)
    } catch (e) {
      options.onError(e instanceof Error ? e.message : String(e))
    }
  })

  try {
    select.value = (await api.getSettings()).profile
  } catch (e) {
    console.error('Failed to load tone profile', e)
  }
}
