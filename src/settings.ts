import { initNavigation } from './navigation'
import { initAbout } from './settings/about'
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

  if (!window.electronAPI) return
  const about = document.getElementById('settings-about')
  if (about) void initAbout(about)

  const initPage = PAGE_INITIALIZERS[document.body.dataset.page ?? '']
  if (initPage) await initPage()
})
