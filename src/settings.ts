import { initNavigation } from './navigation'
import { renderSettingsNav } from './settings/shared'
import { initModelsPage } from './settings/models-page'
import { initRulesPage } from './settings/rules-page'
import { initShortcutsPage } from './settings/shortcuts-page'

const PAGE_INITIALIZERS: Record<string, () => Promise<void>> = {
  models: initModelsPage,
  rules: initRulesPage,
  shortcuts: initShortcutsPage,
}

document.addEventListener('DOMContentLoaded', async () => {
  const nav = document.getElementById('settings-nav')
  if (nav) renderSettingsNav(nav)
  initNavigation();

  const btnClose = document.getElementById('btn-close')
  const btnMinimize = document.getElementById('btn-minimize')
  const btnMaximize = document.getElementById('btn-maximize')

  if (btnClose) btnClose.addEventListener('click', () => window.electronAPI?.closeWindow())
  if (btnMinimize) btnMinimize.addEventListener('click', () => window.electronAPI?.minimizeWindow())
  if (btnMaximize) btnMaximize.addEventListener('click', () => window.electronAPI?.maximizeWindow())

  const initPage = PAGE_INITIALIZERS[document.body.dataset.page ?? '']
  if (initPage && window.electronAPI) await initPage()
})
