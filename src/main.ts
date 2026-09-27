import { AudioRecorder } from './audio-recorder'
import { initNavigation } from './navigation'
import { modelDisplayName } from '../electron/modelCatalog'
import { initToneTabs } from './tone-tabs'

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();

  // Load available models
  window.electronAPI?.getModels?.().then((models) => {
    const sttSelect = document.getElementById('stt-model-select') as HTMLSelectElement;
    const llmSelect = document.getElementById('llm-model-select') as HTMLSelectElement;
    
    if (sttSelect) {
      sttSelect.innerHTML = '';
      if (models.whisper.length === 0) {
        sttSelect.innerHTML = '<option value="">No model found</option>';
        sttSelect.disabled = true;
      } else {
        models.whisper.forEach(m => {
          const option = new Option(modelDisplayName(m), m);
          option.className = 'bg-studio-surface text-studio-heading';
          sttSelect.add(option);
        });
      }
    }
    
    if (llmSelect) {
      llmSelect.innerHTML = '';
      if (models.llama.length === 0) {
        llmSelect.innerHTML = '<option value="">No model found</option>';
        llmSelect.disabled = true;
      } else {
        models.llama.forEach(m => {
          const option = new Option(modelDisplayName(m), m);
          option.className = 'bg-studio-surface text-studio-heading';
          llmSelect.add(option);
        });
      }
    }
  });

  const recordBtn = document.getElementById('recordToggleBtn');
  let isListening = false;
  const audioRecorder = new AudioRecorder();

  // Populate microphone list
  const micSelect = document.getElementById('mic-select') as HTMLSelectElement;
  if (micSelect) {
    audioRecorder.getMicrophones().then(devices => {
      micSelect.innerHTML = '<option value="">Predeterminado</option>';
      devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Micrófono ${micSelect.length}`;
        option.className = 'bg-studio-surface text-studio-heading';
        micSelect.appendChild(option);
      });
    });

    micSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      audioRecorder.setMicrophone(target.value);
    });
  }

  // AI Result Handlers
  let lastTranscription = '';

  window.electronAPI?.onTranscription((text: string) => {
    lastTranscription = text;
    // Show original transcribed text
    const editorEl = document.getElementById('live-transcription')
    if (editorEl) {
      if (editorEl.innerText.includes('Esperando voz...')) {
        editorEl.innerHTML = '';
      }
      editorEl.innerHTML += `<p class="text-on-surface/50 italic mb-2">🎤 ${text}</p>`
    }
  })

  window.electronAPI?.onCorrection((text: string) => {
    // Show corrected text
    const editorEl = document.getElementById('grammar-review-container')
    if (editorEl) {
      if (editorEl.innerText.includes('Esperando voz...')) {
        editorEl.innerHTML = '';
      }
      editorEl.innerHTML += `<p class="mb-4 text-zinc-300">✨ ${text}</p>`
    }

    const primaryRecEl = document.getElementById('primary-recommendation')
    if (primaryRecEl) {
      primaryRecEl.innerText = text;
    }
  })

  if (recordBtn) {
    recordBtn.addEventListener('click', async () => {
      isListening = !isListening;
      if (isListening) {
        recordBtn.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          <span class="text-xs text-studio-heading font-medium tracking-wide">Escuchando</span>
          <span class="text-[10px] font-mono text-zinc-400 bg-white/[0.06] px-1.5 py-0.5 rounded border border-studio-border">Espacio</span>
        `;
        
        await audioRecorder.startRecording((pcmData) => {
          // Send PCM data to backend for Whisper transcription
          window.electronAPI?.sendAudioChunk(pcmData);
        });

      } else {
        recordBtn.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-zinc-500"></span>
          <span class="text-xs text-zinc-400 font-medium tracking-wide">Procesando AI...</span>
          <span class="text-[10px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded border border-studio-border">Espacio</span>
        `;
        
        audioRecorder.stopRecording();
        window.electronAPI?.sendAudioStop();
        
        setTimeout(() => {
          recordBtn.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-zinc-500"></span>
            <span class="text-xs text-zinc-400 font-medium tracking-wide">En pausa</span>
            <span class="text-[10px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded border border-studio-border">Espacio</span>
          `;
        }, 3000);
      }
    });
  }

  // Global shortcut (configured in Settings > Atajos) arrives from the main process
  window.electronAPI?.onToggleRecording?.(() => recordBtn?.click());

  // Tone tabs switch the correction profile and re-correct the last dictation
  const toneTabs = document.getElementById('tone-tabs');
  if (toneTabs && window.electronAPI) {
    const primaryRecEl = document.getElementById('primary-recommendation');
    let previousText = '';
    initToneTabs(toneTabs, {
      getText: () => lastTranscription,
      onPending: () => {
        if (!primaryRecEl) return;
        previousText = primaryRecEl.innerText;
        primaryRecEl.innerText = 'Reescribiendo…';
      },
      onResult: (corrected) => {
        if (primaryRecEl) primaryRecEl.innerText = corrected;
      },
      onError: (message) => {
        console.error('Tone rewrite failed:', message);
        if (primaryRecEl && previousText) primaryRecEl.innerText = previousText;
      },
    });
  }

  window.addEventListener('keydown', (e) => {
    const targetTag = (e.target as HTMLElement).tagName;
    const isInput = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT';
    if (e.code === 'Space' && !isInput) {
      e.preventDefault();
      recordBtn?.click();
    }
  });

  window.copyCurrentSuggestion = () => {
    const primaryRecEl = document.getElementById('primary-recommendation');
    const textToCopy = primaryRecEl ? primaryRecEl.innerText : "";
    if (!textToCopy || textToCopy.includes('Esperando voz...')) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      const copyText = document.getElementById('copyBtnText');
      if (copyText) {
        const original = copyText.innerText;
        copyText.innerText = "Copiado";
        setTimeout(() => {
          copyText.innerText = original;
        }, 1800);
      }
    });
  }
})
