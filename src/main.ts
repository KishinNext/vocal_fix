import { AudioRecorder } from './audio-recorder'
import { initNavigation } from './navigation'
import { initToneTabs } from './tone-tabs'
import { Speaker } from './speech'
import { TranscriptView } from './transcript-view'
import {
  bindModelSelect, fillMicrophoneSelect, fillModelSelect, isTypingTarget, renderRecordButton, type RecordState,
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

  // Model dropdowns show and change the models saved in Settings
  Promise.all([api.getModels(), api.getSettings()]).then(([models, settings]) => {
    const showError = (message: string) => view?.error(message)
    if (sttSelect) {
      fillModelSelect(sttSelect, models.whisper, settings.whisperModel)
      bindModelSelect(sttSelect, file => api.activateModel('whisper', file), showError)
    }
    if (llmSelect) {
      fillModelSelect(llmSelect, models.llama, settings.llmModel)
      bindModelSelect(llmSelect, file => api.activateModel('llm', file), showError)
    }
  })

  const audioRecorder = new AudioRecorder()
  if (micSelect) {
    audioRecorder.getMicrophones().then(devices => fillMicrophoneSelect(micSelect, devices))
    micSelect.addEventListener('change', () => audioRecorder.setMicrophone(micSelect.value))
  }

  // ── Listen: reads the suggested text aloud ──
  const speakBtn = document.getElementById('speakBtn') as HTMLButtonElement | null
  const speakLabel = document.getElementById('speakBtnText')
  const speaker = new Speaker()
  const renderSpeak = () => {
    if (speakLabel) speakLabel.textContent = speaker.isSpeaking ? 'Detener' : 'Escuchar'
    if (speakBtn) speakBtn.disabled = !speaker.isSpeaking && !view?.naturalText()
  }

  const view = transcriptionEl && reviewEl && primaryRecEl
    ? new TranscriptView({ transcription: transcriptionEl, review: reviewEl, natural: primaryRecEl }, renderSpeak)
    : null

  speakBtn?.addEventListener('click', () => {
    const text = view?.naturalText()
    if (speaker.isSpeaking || !text) speaker.stop()
    else speaker.speak(text, renderSpeak)
    renderSpeak()
  })

  document.getElementById('clearBtn')?.addEventListener('click', () => {
    speaker.stop()
    view?.clear()
  })

  // ── Recording: audio streams to the main process, which transcribes on every pause ──
  const setRecordState = (state: RecordState) => { if (recordBtn) renderRecordButton(recordBtn, state) }
  const isListening = () => recordBtn?.dataset.state === 'listening'

  const stopRecording = async () => {
    setRecordState('idle')
    await audioRecorder.stopRecording() // sends the last buffered audio first
    api.sendAudioStop()
  }

  recordBtn?.addEventListener('click', async () => {
    if (isListening()) {
      await stopRecording()
      return
    }
    setRecordState('listening')
    try {
      await audioRecorder.startRecording(pcm => api.sendAudioChunk(pcm))
    } catch (e) {
      setRecordState('idle')
      view?.error(`No se pudo abrir el micrófono: ${e instanceof Error ? e.message : String(e)}`)
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
  if (view) {
    api.onStreamPartial(({ id, text }) => view.partial(id, text))
    api.onStreamFinal(({ id, text }) => view.final(id, text))
    api.onStreamGrammar(({ id, text }) => view.grammar(id, text))
    api.onStreamNatural(({ id, text }) => view.natural(id, text))
  }

  // Pipeline failures (missing model, whisper.cpp not built...) stop the recording
  api.onAiError(message => {
    view?.error(message)
    if (isListening()) void stopRecording()
  })

  // ── Tone tabs: switch the profile and re-write every confirmed sentence ──
  const toneTabs = document.getElementById('tone-tabs')
  if (toneTabs && view) {
    initToneTabs(toneTabs, {
      onChange: () => view.rewriteAll(text => api.rewriteNatural(text)),
      onError: message => view.error(message),
    })
  }

  // ── Copy ──
  document.getElementById('copyBtn')?.addEventListener('click', async () => {
    const text = view?.naturalText() ?? ''
    if (!text) return

    await navigator.clipboard.writeText(text)
    const label = document.getElementById('copyBtnText')
    if (!label) return
    const original = label.innerText
    label.innerText = 'Copiado'
    setTimeout(() => { label.innerText = original }, COPY_FEEDBACK_MS)
  })
})
