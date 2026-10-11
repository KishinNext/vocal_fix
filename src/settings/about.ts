import { updateStatusText, type UpdateState } from '../../electron/updateState'
import { errorMessage, showStatus } from './shared'

// Sidebar footer of every settings page: version, update status and the update check.
export async function initAbout(container: HTMLElement) {
  const api = window.electronAPI

  container.innerHTML = `
    <div data-version class="text-vf-mute"></div>
    <button type="button" data-update-status class="text-left cursor-default"></button>
    <button type="button" data-check class="vf-btn-text -mx-1.5 self-start">Buscar actualizaciones</button>
    <label class="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" data-auto class="rounded-sm bg-vf-field border-vf-stroke text-vf-amber focus:ring-0 focus:ring-offset-0">
      Buscar al iniciar
    </label>`
  const version = container.querySelector('[data-version]')!
  const status = container.querySelector<HTMLButtonElement>('[data-update-status]')!
  const check = container.querySelector<HTMLButtonElement>('[data-check]')!
  const auto = container.querySelector<HTMLInputElement>('[data-auto]')!

  const render = (state: UpdateState) => {
    version.textContent = `VocalFix ${state.current}`
    status.textContent = updateStatusText(state)
    // With an update available the line itself starts it
    const actionable = Boolean(state.latest) && state.phase !== 'downloading'
    status.disabled = !actionable
    status.className = `text-left ${actionable ? 'text-vf-amber cursor-pointer hover:underline' : 'cursor-default'}`
    check.disabled = state.phase === 'checking' || state.phase === 'downloading'
  }

  status.addEventListener('click', () => void api.installUpdate())
  check.addEventListener('click', () => void api.checkUpdates())
  auto.addEventListener('change', async () => {
    try {
      await api.updateSettings({ checkUpdates: auto.checked })
      showStatus('Guardado')
    } catch (e) {
      showStatus(errorMessage(e), 'error')
    }
  })

  api.onUpdateState(render)
  try {
    auto.checked = (await api.getSettings()).checkUpdates
    render(await api.getUpdateState())
  } catch (e) {
    showStatus(errorMessage(e), 'error')
  }
}
