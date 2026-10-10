import { AudioRecorder } from './audio-recorder'
import { initNavigation } from './navigation'
import { initToneSelect } from './tone-select'
import { Speaker } from './speech'
import { TranscriptView } from './transcript-view'
import {
  createLevelMeter, fillMicrophoneSelect, formatElapsed, isTypingTarget, renderEngineDot, renderRecordButton,
  restingRecordState, type RecordState,
} from './editor'
import { modelDisplayName } from '../electron/modelCatalog'

const COPY_FEEDBACK_MS = 1800
const REC_TIMER_MS = 500

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  const api = window.electronAPI
  if (!api) return

  const transcriptionEl = document.getElementById('live-transcription')
  const reviewEl = document.getElementById('grammar-review-container')
  const primaryRecEl = document.getElementById('primary-recommendation')
  const recordBtn = document.getElementById('recordToggleBtn')
  const sttLabel = document.getElementById('stt-model-label')
  const llmLabel = document.getElementById('llm-model-label')
  const micSelect = document.getElementById('mic-select') as HTMLSelectElement | null

  // The header pill names the models in use; clicking it opens Settings > Modelos locales
  api.getSettings().then(settings => {
    if (sttLabel) sttLabel.textContent = modelDisplayName(settings.whisperModel)
    if (llmLabel) llmLabel.textContent = modelDisplayName(settings.llmModel)
  })

  const audioRecorder = new AudioRecorder()
  const levelEl = document.getElementById('mic-level')
  const levelMeter = levelEl ? createLevelMeter(levelEl) : null
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
  let recTimer: ReturnType<typeof setInterval> | undefined
  const setRecordState = (state: RecordState) => {
    if (!recordBtn) return
    renderRecordButton(recordBtn, state)
    clearInterval(recTimer)
    if (state !== 'listening') return
    const startedAt = Date.now()
    recTimer = setInterval(() => {
      const time = recordBtn.querySelector('[data-rec-time]')
      if (time) time.textContent = formatElapsed((Date.now() - startedAt) / 1000)
    }, REC_TIMER_MS)
  }
  const isListening = () => recordBtn?.dataset.state === 'listening'

  // Dots in the header pill: whether each model is loading, ready or unusable.
  // Recording is only offered once both are ready.
  const sttDot = document.getElementById('stt-dot')
  const llmDot = document.getElementById('llm-dot')
  const modelsPill = document.getElementById('models-pill')
  let resting: RecordState = 'loading'
  const restingState = () => resting
  const applyEngineStatus = (status: Awaited<ReturnType<typeof api.getEngineStatus>>) => {
    const tips = [
      sttDot ? renderEngineDot(sttDot, 'Transcripción', status.whisper) : '',
      llmDot ? renderEngineDot(llmDot, 'Motor lingüístico', status.llm) : '',
    ]
    if (modelsPill) modelsPill.title = tips.filter(Boolean).join('\n')
    resting = restingRecordState(status)
    if (!isListening()) setRecordState(restingState())
  }
  setRecordState(restingState())
  api.onEngineStatus(applyEngineStatus)
  api.getEngineStatus().then(applyEngineStatus)

  const stopRecording = async () => {
    setRecordState(restingState())
    levelMeter?.reset()
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
      await audioRecorder.startRecording(pcm => api.sendAudioChunk(pcm), level => levelMeter?.push(level))
    } catch (e) {
      setRecordState(restingState())
      levelMeter?.reset()
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

  // ── Tone: switch the profile and re-write every confirmed sentence ──
  const toneSelect = document.getElementById('tone-select') as HTMLSelectElement | null
  if (toneSelect && view) {
    initToneSelect(toneSelect, {
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
