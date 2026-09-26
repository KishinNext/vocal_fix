import { AudioRecorder } from './audio-recorder'
import { initNavigation } from './navigation'

// @ts-nocheck
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  const btnClose = document.getElementById('btn-close')
  const btnMinimize = document.getElementById('btn-minimize')
  const btnMaximize = document.getElementById('btn-maximize')
  const btnSettings = document.getElementById('btn-settings')

  if (btnClose) btnClose.addEventListener('click', () => window.electronAPI?.closeWindow())
  if (btnMinimize) btnMinimize.addEventListener('click', () => window.electronAPI?.minimizeWindow())
  if (btnMaximize) btnMaximize.addEventListener('click', () => window.electronAPI?.maximizeWindow())
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      console.log('Settings button clicked! Calling window.electronAPI.openSettings()', window.electronAPI);
      if (window.electronAPI?.openSettings) {
        window.electronAPI.openSettings();
      } else {
        console.error('window.electronAPI.openSettings is undefined!');
      }
    });
  }

  // Stub recording functionality for now
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
  window.electronAPI?.onTranscription((text: string) => {
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

  window.electronAPI?.onMemoryStats?.((memoryGB: string) => {
    const memEl = document.getElementById('gpu-memory');
    if (memEl) {
      memEl.innerText = memoryGB;
    }
  });

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
