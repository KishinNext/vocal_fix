import path from 'path'

// Maps an app:// request to a file inside the renderer build, or null when the
// URL tries to leave that folder.
export function resolveAppFile(root: string, requestUrl: string): string | null {
  const file = path.join(root, decodeURIComponent(new URL(requestUrl).pathname))
  return file.startsWith(root + path.sep) ? file : null
}
