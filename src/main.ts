import { AudioRecorder } from './audio-recorder'
import { initNavigation } from './navigation'
import { initToneTabs } from './tone-tabs'
import {
  PLACEHOLDER, appendLine, fillMicrophoneSelect, fillModelSelect, isTypingTarget, renderRecordButton,
} from './editor'

const COPY_FEEDBACK_MS = 1800

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  const api = window.electronAPI
  if (!api) return

  const transcriptionEl = document.getElementById('live-transcription')
  const reviewEl = document.getElementById('grammar-review-container')
  const primaryRecEl = document.getElementById('primary-recommendation')
  const recordBtn = document.getElementById('recordToggleBtn')
  const sttSelect = document.getElementById('stt-model-select') as HTMLSelectElement | null
  const llmSelect = document.getElementById('llm-model-select') as HTMLSelectElement | null
  const micSelect = document.getElementById('mic-select') as HTMLSelectElement | null

  api.getModels().then(models => {
    if (sttSelect) fillModelSelect(sttSelect, models.whisper)
    if (llmSelect) fillModelSelect(llmSelect, models.llama)
  })

  const audioRecorder = new AudioRecorder()
  if (micSelect) {
    audioRecorder.getMicrophones().then(devices => fillMicrophoneSelect(micSelect, devices))
    micSelect.addEventListener('change', () => audioRecorder.setMicrophone(micSelect.value))
  }

  // ── Recording ──
  const setIdle = () => { if (recordBtn) renderRecordButton(recordBtn, 'idle') }

  recordBtn?.addEventListener('click', async () => {
    const state = recordBtn.dataset.state ?? 'idle'
    if (state === 'processing') return

    if (state === 'idle') {
      renderRecordButton(recordBtn, 'listening')
      await audioRecorder.startRecording(pcmData => api.sendAudioChunk(pcmData))
    } else {
      // Stays "processing" until the pipeline answers (result or error)
      renderRecordButton(recordBtn, 'processing')
      audioRecorder.stopRecording()
      api.sendAudioStop()
    }
  })

  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !isTypingTarget(e.target)) {
      e.preventDefault()
      recordBtn?.click()
    }
  })

  // Global shortcut (configured in Settings > Atajos) arrives from the main process
  api.onToggleRecording(() => recordBtn?.click())

  // ── Pipeline results ──
  let lastTranscription = ''

  api.onTranscription(text => {
    lastTranscription = text
    if (transcriptionEl) appendLine(transcriptionEl, `🎤 ${text}`, 'text-on-surface/50 italic mb-2')
    if (!text) setIdle() // nothing to correct, so no correction event will follow
  })

  api.onCorrection(text => {
    if (reviewEl) appendLine(reviewEl, `✨ ${text}`, 'mb-4 text-zinc-300')
    if (primaryRecEl) primaryRecEl.innerText = text
    setIdle()
  })

  // Pipeline failures (missing model, whisper.cpp not built...) used to be swallowed
  api.onAiError(message => {
    if (transcriptionEl) appendLine(transcriptionEl, `⚠ ${message}`, 'text-sm text-rose-400 mb-2')
    setIdle()
  })

  // ── Tone tabs: switch the correction profile and re-correct the last dictation ──
  const toneTabs = document.getElementById('tone-tabs')
  if (toneTabs) {
    let previousText = ''
    initToneTabs(toneTabs, {
      getText: () => lastTranscription,
      onPending: () => {
        if (!primaryRecEl) return
        previousText = primaryRecEl.innerText
        primaryRecEl.innerText = 'Reescribiendo…'
      },
      onResult: corrected => {
        if (primaryRecEl) primaryRecEl.innerText = corrected
      },
      onError: message => {
        console.error('Tone rewrite failed:', message)
        if (primaryRecEl && previousText) primaryRecEl.innerText = previousText
      },
    })
  }

  // ── Copy ──
  document.getElementById('copyBtn')?.addEventListener('click', async () => {
    const text = primaryRecEl?.innerText ?? ''
    if (!text || text.includes(PLACEHOLDER)) return

    await navigator.clipboard.writeText(text)
    const label = document.getElementById('copyBtnText')
    if (!label) return
    const original = label.innerText
    label.innerText = 'Copiado'
    setTimeout(() => { label.innerText = original }, COPY_FEEDBACK_MS)
  })
})
