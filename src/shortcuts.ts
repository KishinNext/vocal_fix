// @ts-nocheck
document.addEventListener('DOMContentLoaded', () => {
  const btnClose = document.getElementById('btn-close')
  const btnMinimize = document.getElementById('btn-minimize')
  const btnMaximize = document.getElementById('btn-maximize')

  if (btnClose) btnClose.addEventListener('click', () => window.electronAPI?.closeWindow())
  if (btnMinimize) btnMinimize.addEventListener('click', () => window.electronAPI?.minimizeWindow())
  if (btnMaximize) btnMaximize.addEventListener('click', () => window.electronAPI?.maximizeWindow())

  // Navigation handlers
  const navLinks = document.querySelectorAll('a[data-path]')
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      const path = link.getAttribute('data-path')
      if (path === 'editor') {
        window.location.href = '/index.html'
      } else if (path === 'modelos-locales') {
        window.location.href = '/settings.html'
      } else if (path === 'atajos-teclado-hotkeys') {
        window.location.href = '/shortcuts.html'
      }
    })
  })
})
