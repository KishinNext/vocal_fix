// "v1.2.10" or "1.2.10" -> [1, 2, 10]; anything else -> null
function parse(version: string): number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim())
  return match ? match.slice(1).map(Number) : null
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parse(candidate)
  const b = parse(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}
