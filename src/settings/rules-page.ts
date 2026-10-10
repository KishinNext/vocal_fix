import type { AppSettings, GrammarRules, Profile } from '../../electron/settingsSchema'
import { byId, errorMessage, escapeHtml, showStatus } from './shared'

let settings: AppSettings | null = null

function renderProfiles() {
  document.querySelectorAll<HTMLButtonElement>('[data-profile]').forEach(row => {
    const active = row.dataset.profile === settings?.profile
    row.classList.toggle('bg-[#202023]', active)
    row.classList.toggle('bg-vf-rail', !active)
    row.setAttribute('aria-checked', String(active))
    const radio = row.querySelector('[data-radio]')
    radio?.classList.toggle('border-4', active)
    radio?.classList.toggle('border-vf-amber', active)
    radio?.classList.toggle('border-[1.5px]', !active)
    radio?.classList.toggle('border-[#55555c]', !active)
  })
}

function renderToggles() {
  document.querySelectorAll<HTMLButtonElement>('[data-rule]').forEach(toggle => {
    const on = Boolean(settings?.rules[toggle.dataset.rule as keyof GrammarRules])
    toggle.setAttribute('aria-checked', String(on))
    const track = toggle.querySelector('[data-track]')
    track?.classList.toggle('bg-vf-amber', on)
    track?.classList.toggle('bg-vf-stroke2', !on)
    toggle.querySelector('[data-knob]')?.classList.toggle('translate-x-[14px]', on)
  })
}

function renderGlossary() {
  const container = byId('glossary-terms')
  if (!container || !settings) return
  container.innerHTML = settings.glossary.map(term => `
    <span class="flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-md bg-vf-raised border border-vf-chip text-xs">
      ${escapeHtml(term)}
      <button type="button" data-remove-term="${escapeHtml(term)}" title="Quitar"
        class="w-4 h-4 leading-none rounded text-vf-faint cursor-pointer hover:text-vf-red">×</button>
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
