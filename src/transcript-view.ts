import { diffWords } from './word-diff'

// The three editor panels render one row per utterance, from the same list, so the
// transcription, its grammar review and its natural expression stay in step.

interface Segment {
  id: string
  text: string            // what was said (partial until confirmed)
  final: boolean
  grammar: string | null
  natural: string | null
}

interface Row {
  said: HTMLParagraphElement
  review: HTMLParagraphElement
  natural: HTMLParagraphElement
}

export interface TranscriptPanels {
  transcription: HTMLElement
  review: HTMLElement
  natural: HTMLElement
}

const CLASSES = {
  saidPartial: 'mb-2 text-zinc-500',
  saidFinal: 'mb-2',
  review: 'mb-2 text-zinc-300 leading-relaxed',
  natural: 'mb-2 text-studio-heading',
  pending: 'mb-2 text-zinc-600',
  del: 'line-through text-rose-400/80',
  add: 'text-emerald-400 bg-emerald-500/15 rounded px-1',
  error: 'mb-2 text-sm text-rose-400',
}

const PENDING_TEXT = '…'

export class TranscriptView {
  private readonly segments = new Map<string, Segment>()
  private readonly rows = new Map<string, Row>()
  private generation = 0
  private readonly panels: TranscriptPanels
  private readonly placeholders: Map<HTMLElement, Node[]>
  private readonly onChange: () => void

  // onChange runs whenever the suggested text (naturalText) may have changed
  constructor(panels: TranscriptPanels, onChange: () => void = () => {}) {
    this.panels = panels
    this.onChange = onChange
    this.placeholders = new Map(Object.values(panels).map(panel => [
      panel, [...panel.childNodes].map(node => node.cloneNode(true)),
    ]))
  }

  // Empties every panel and shows the "waiting for voice" placeholders again
  clear() {
    this.generation++ // results of a rewrite in progress no longer have a row to go to
    this.segments.clear()
    this.rows.clear()
    for (const [panel, nodes] of this.placeholders) {
      panel.replaceChildren(...nodes.map(node => node.cloneNode(true)))
      delete panel.dataset.started
    }
    this.onChange()
  }

  partial(id: string, text: string) {
    const segment = this.segment(id)
    if (segment.final) return
    segment.text = text
    this.row(id).said.textContent = text
  }

  final(id: string, text: string) {
    if (!text) {
      this.remove(id) // silence or noise: drop the partial that was shown
      return
    }
    const segment = this.segment(id)
    segment.text = text
    segment.final = true
    const row = this.row(id)
    row.said.className = CLASSES.saidFinal
    row.said.textContent = text
    this.showPending(row.review)
    this.showPending(row.natural)
  }

  grammar(id: string, corrected: string) {
    const segment = this.segments.get(id)
    if (!segment) return
    segment.grammar = corrected
    const review = this.row(id).review
    review.className = CLASSES.review
    review.replaceChildren()
    for (const part of diffWords(segment.text, corrected)) {
      if (review.childNodes.length > 0) review.append(' ')
      if (part.type === 'same') {
        review.append(part.text)
      } else {
        const span = document.createElement('span')
        span.className = CLASSES[part.type]
        span.textContent = part.text
        review.append(span)
      }
    }
  }

  natural(id: string, text: string) {
    const segment = this.segments.get(id)
    if (!segment) return
    segment.natural = text
    const natural = this.row(id).natural
    natural.className = CLASSES.natural
    natural.textContent = text
    this.onChange()
  }

  // Full suggested text, for copying
  naturalText(): string {
    return [...this.segments.values()].map(s => s.natural).filter(Boolean).join(' ')
  }

  // Re-writes every confirmed utterance (tone change). Only the latest call writes results.
  async rewriteAll(rewrite: (text: string) => Promise<string>) {
    const generation = ++this.generation
    const confirmed = [...this.segments.values()].filter(s => s.final)
    confirmed.forEach(s => this.showPending(this.row(s.id).natural))
    try {
      for (const segment of confirmed) {
        const text = await rewrite(segment.grammar ?? segment.text)
        if (generation !== this.generation) return
        this.natural(segment.id, text)
      }
    } catch (e) {
      // Put back the suggestions that were not rewritten
      if (generation === this.generation) {
        confirmed.forEach(s => { if (s.natural) this.natural(s.id, s.natural) })
      }
      throw e
    }
  }

  error(message: string) {
    const line = document.createElement('p')
    line.className = CLASSES.error
    line.textContent = `⚠ ${message}`
    this.start(this.panels.transcription).append(line)
  }

  private segment(id: string): Segment {
    let segment = this.segments.get(id)
    if (!segment) {
      segment = { id, text: '', final: false, grammar: null, natural: null }
      this.segments.set(id, segment)
    }
    return segment
  }

  private row(id: string): Row {
    let row = this.rows.get(id)
    if (!row) {
      row = {
        said: this.paragraph(this.panels.transcription, CLASSES.saidPartial),
        review: this.paragraph(this.panels.review, CLASSES.review),
        natural: this.paragraph(this.panels.natural, CLASSES.natural),
      }
      this.rows.set(id, row)
    }
    return row
  }

  private remove(id: string) {
    const row = this.rows.get(id)
    row?.said.remove()
    row?.review.remove()
    row?.natural.remove()
    this.rows.delete(id)
    this.segments.delete(id)
    this.onChange()
  }

  private paragraph(panel: HTMLElement, className: string) {
    const p = document.createElement('p')
    p.className = className
    this.start(panel).append(p)
    return p
  }

  private showPending(p: HTMLParagraphElement) {
    p.className = CLASSES.pending
    p.textContent = PENDING_TEXT
  }

  // Clears the "waiting for voice" placeholder the first time a panel gets content
  private start(panel: HTMLElement): HTMLElement {
    if (panel.dataset.started !== 'true') {
      panel.replaceChildren()
      panel.dataset.started = 'true'
    }
    return panel
  }
}
