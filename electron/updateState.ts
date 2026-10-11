// Shared between the main process (updates.ts) and the windows that show it.

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'error'

export interface UpdateState {
  current: string        // version of this app
  latest: string | null  // newer version found, without the "v"
  url: string            // page where it can be downloaded
  phase: UpdatePhase
  percent: number        // while downloading
  message: string        // why the check or the download failed
  installsInApp: boolean // false: the user downloads the installer from `url`
}

// Label of the notice in the editor header; '' hides it
export function updateNoticeText(state: UpdateState): string {
  if (!state.latest) return ''
  if (state.phase === 'downloading') return `Descargando ${state.percent}%`
  if (state.phase === 'error') return 'Actualización fallida · Reintentar'
  return `Nueva versión ${state.latest}`
}

// Line under the version in Settings
export function updateStatusText(state: UpdateState): string {
  if (state.phase === 'checking') return 'Buscando actualizaciones…'
  if (state.latest) return updateNoticeText(state)
  if (state.phase === 'error') return `No se pudo comprobar: ${state.message}`
  return 'Estás al día'
}
