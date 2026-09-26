import { initNavigation } from './navigation'

// @ts-nocheck
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  const btnClose = document.getElementById('btn-close')
  const btnMinimize = document.getElementById('btn-minimize')
  const btnMaximize = document.getElementById('btn-maximize')

  if (btnClose) btnClose.addEventListener('click', () => window.electronAPI?.closeWindow())
  if (btnMinimize) btnMinimize.addEventListener('click', () => window.electronAPI?.minimizeWindow())
  if (btnMaximize) btnMaximize.addEventListener('click', () => window.electronAPI?.maximizeWindow())
})
