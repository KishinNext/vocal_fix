import { updateNoticeText, type UpdateState } from '../electron/updateState'

// The header button that appears when a newer release exists. Clicking it is what
// starts the download (Windows) or opens the download page (macOS).
export function initUpdateNotice(button: HTMLButtonElement) {
  const api = window.electronAPI

  const render = (state: UpdateState) => {
    const text = updateNoticeText(state)
    button.textContent = text
    button.classList.toggle('hidden', !text)
    button.disabled = state.phase === 'downloading'
    button.title = state.installsInApp ? 'Descargar e instalar la actualización' : 'Abrir la página de descarga'
  }

  button.addEventListener('click', () => void api.installUpdate())
  api.onUpdateState(render)
  api.getUpdateState().then(render)
}
