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

2. **Download AI Models:**
   VocalFix requires local AI models to function. Run the built-in script to download the minimal required `.bin` and `.gguf` files (approx. 800MB):
   ```bash
   node scripts/download-models.js
   ```

3. **Run the App:**
   ```bash
   npm run dev
   ```

## Architecture
- `electron/main.ts`: The main process. Handles window management, IPC routing, and audio WAV generation.
- `electron/ai.ts`: The AI controller. Interfaces with local Whisper and LLaMA binaries.
- `src/`: The renderer process. Contains UI logic and the `audio-recorder.ts` utility for capturing microphone streams via the Web Audio API.
