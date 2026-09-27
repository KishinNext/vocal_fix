const ROUTES: Record<string, string> = {
  'editor': '/index.html',
  'ajustes': '/pages/settings.html',
  'modelos-locales': '/pages/settings.html',
  'reglas-gramaticales-estilo': '/pages/reglas-gramaticales-estilo.html',
  'atajos-teclado-hotkeys': '/pages/atajos-teclado-hotkeys.html',
}

export function initNavigation() {
  document.querySelectorAll('a[data-path], button[data-path]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      const path = link.getAttribute('data-path') ?? ''
      const route = ROUTES[path]
      if (route) window.location.href = route
      else console.log('Navigation path not implemented yet:', path)
    })
  })
}
