import type { AppSettings, GrammarRules, Profile } from '../../electron/settingsSchema'
import { byId, errorMessage, escapeHtml, showStatus } from './shared'

let settings: AppSettings | null = null

function renderProfiles() {
  document.querySelectorAll<HTMLButtonElement>('[data-profile]').forEach(card => {
    const active = card.dataset.profile === settings?.profile
    card.classList.toggle('border-primary/50', active)
    card.classList.toggle('bg-surface-container-high', active)
    card.classList.toggle('border-transparent', !active)
    card.classList.toggle('bg-surface-container', !active)
    card.setAttribute('aria-checked', String(active))
    const icon = card.querySelector('[data-radio]')
    if (icon) {
      icon.textContent = active ? 'radio_button_checked' : 'radio_button_unchecked'
      icon.classList.toggle('text-primary', active)
      icon.classList.toggle('text-outline', !active)
    }
  })
}

function renderToggles() {
  document.querySelectorAll<HTMLButtonElement>('[data-rule]').forEach(toggle => {
    const on = Boolean(settings?.rules[toggle.dataset.rule as keyof GrammarRules])
    toggle.setAttribute('aria-checked', String(on))
    toggle.classList.toggle('bg-primary', on)
    toggle.classList.toggle('bg-surface-container-highest', !on)
    toggle.querySelector('span')?.classList.toggle('translate-x-4', on)
  })
}

function renderGlossary() {
  const container = byId('glossary-terms')
  if (!container || !settings) return
  container.innerHTML = settings.glossary.length === 0
    ? '<span class="font-label-xs text-label-xs text-outline">Sin términos. Ej.: nombres propios, marcas o jerga técnica.</span>'
    : settings.glossary.map(term => `
        <span class="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded bg-surface-container-high text-on-surface font-label-xs text-label-xs">
          ${escapeHtml(term)}
          <button type="button" data-remove-term="${escapeHtml(term)}" title="Quitar"
            class="material-symbols-outlined text-[13px] text-outline hover:text-error">close</button>
        </span>`).join('')
}

async function renderPromptPreview() {
  const preview = byId('prompt-preview')
  if (preview) preview.textContent = await window.electronAPI.getSystemPrompt()
}

async function save(patch: Partial<AppSettings>) {
  try {
    settings = await window.electronAPI.updateSettings(patch)
    renderProfiles()
    renderToggles()
    renderGlossary()
    await renderPromptPreview()
    showStatus('Guardado')
  } catch (e) {
    showStatus(errorMessage(e), 'error')
  }
}

export async function initRulesPage() {
  document.querySelectorAll<HTMLButtonElement>('[data-profile]').forEach(card => {
    card.addEventListener('click', () => save({ profile: card.dataset.profile as Profile }))
  })

  document.querySelectorAll<HTMLButtonElement>('[data-rule]').forEach(toggle => {
    toggle.addEventListener('click', () => {
      if (!settings) return
      const rule = toggle.dataset.rule as keyof GrammarRules
      void save({ rules: { ...settings.rules, [rule]: !settings.rules[rule] } })
    })
  })

  const input = byId<HTMLInputElement>('glossary-input')
  const addTerm = () => {
    const term = input?.value.trim()
    if (!term || !settings || !input) return
    input.value = ''
    void save({ glossary: [...settings.glossary, term] })
  }
  byId('glossary-add')?.addEventListener('click', addTerm)
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTerm()
  })
  byId('glossary-terms')?.addEventListener('click', e => {
    const term = (e.target as HTMLElement).closest<HTMLElement>('[data-remove-term]')?.dataset.removeTerm
    if (term && settings) void save({ glossary: settings.glossary.filter(t => t !== term) })
  })

  try {
    settings = await window.electronAPI.getSettings()
    renderProfiles()
    renderToggles()
    renderGlossary()
    await renderPromptPreview()
  } catch (e) {
    showStatus(errorMessage(e), 'error')
  }
}
