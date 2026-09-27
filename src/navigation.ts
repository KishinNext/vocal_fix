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
          window.location.href = '/pages/settings.html'
          break;
        case 'atajos-teclado-hotkeys':
          window.location.href = '/pages/atajos-teclado-hotkeys.html'
          break;
        case 'reglas-gramaticales-estilo':
          window.location.href = '/pages/reglas-gramaticales-estilo.html'
          break;
        default:
          console.log('Navigation path not implemented yet:', path)
          break;
      }
    })
  })
}
