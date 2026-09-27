# VocalFix

VocalFix is a local, privacy-first Electron application designed to act as your intelligent voice assistant and natural expression editor. It records your speech, transcribes it completely offline, and automatically corrects your grammar and style using localized AI models.

## Features
- **100% Offline & Private:** No cloud APIs. Audio and text never leave your machine.
- **Whisper.cpp Integration:** Real-time, fast transcription using local Whisper models.
- **LLaMA.cpp Integration:** Hardware-accelerated (Apple Silicon Metal) grammar and style correction using quantized LLM models (e.g., TinyLlama, Phi-3).
- **Beautiful UI:** Tailor-made with modern TailwindCSS, featuring a clean layout and dynamic micro-animations.

## Tech Stack
- **Frontend:** Vanilla TypeScript, HTML, TailwindCSS
- **Backend:** Electron, Node.js
- **AI Core:** `whisper-node` (Speech-to-Text), `node-llama-cpp` (LLM)
- **Bundler:** Vite + Vite-Electron

## Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run the App:**
   ```bash
   npm run dev
   ```

3. **Download AI Models:**
   Open **Settings → Modelos Locales** and download one Whisper model (speech-to-text) and one LLM (grammar & style).
   Each card shows disk space and approximate RAM so you can pick one that fits your machine.

## Architecture
- `electron/main.ts`: The main process. Handles window management, IPC routing, and audio WAV generation.
- `electron/ai.ts`: The AI controller. Interfaces with local Whisper and LLaMA binaries.
- `src/`: The renderer process. Contains UI logic and the `audio-recorder.ts` utility for capturing microphone streams via the Web Audio API.
