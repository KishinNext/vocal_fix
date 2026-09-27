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

  const initPage = PAGE_INITIALIZERS[document.body.dataset.page ?? '']
  if (initPage && window.electronAPI) await initPage()
})
