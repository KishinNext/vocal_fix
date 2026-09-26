export function initNavigation() {
  const navLinks = document.querySelectorAll('a[data-path], button[data-path]')
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      const path = link.getAttribute('data-path')
      
      switch (path) {
        case 'editor':
          window.location.href = '/index.html'
          break;
        case 'ajustes':
        case 'modelos-locales':
          window.location.href = '/settings.html'
          break;
        case 'atajos-teclado-hotkeys':
          window.location.href = '/shortcuts.html'
          break;
        default:
          console.log('Navigation path not implemented yet:', path)
          break;
      }
    })
  })
}
