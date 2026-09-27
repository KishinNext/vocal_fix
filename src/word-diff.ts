// Word-level diff between what was said and its grammar correction, for the review panel.

export interface DiffPart {
  type: 'same' | 'del' | 'add'
  text: string
}

// Casing and punctuation alone are not worth striking through ("yesterday" -> "Yesterday,")
const normalize = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')

function lcsOps(a: string[], b: string[]): DiffPart[] {
  // lengths[i][j] = LCS length of a[i..] and b[j..]
  const lengths = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] = normalize(a[i]) === normalize(b[j])
        ? lengths[i + 1][j + 1] + 1
        : Math.max(lengths[i + 1][j], lengths[i][j + 1])
    }
  }

  const ops: DiffPart[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (normalize(a[i]) === normalize(b[j])) {
      ops.push({ type: 'same', text: b[j] }) // keep the corrected casing/punctuation
      i++
      j++
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      ops.push({ type: 'del', text: a[i++] })
    } else {
      ops.push({ type: 'add', text: b[j++] })
    }
  }
  while (i < a.length) ops.push({ type: 'del', text: a[i++] })
  while (j < b.length) ops.push({ type: 'add', text: b[j++] })
  return ops
}

export function diffWords(before: string, after: string): DiffPart[] {
  const words = (text: string) => text.split(/\s+/).filter(Boolean)
  const merged: DiffPart[] = []
  for (const op of lcsOps(words(before), words(after))) {
    const last = merged[merged.length - 1]
    if (last?.type === op.type) last.text += ` ${op.text}`
    else merged.push({ ...op })
  }
  return merged
}
