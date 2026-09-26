# VocalFix - AI Agent Guidelines

Welcome, fellow AI! This document outlines the architecture, rules, and context of **VocalFix**, an Electron-based application for local voice transcription and grammatical correction.

## Project Goal
VocalFix is designed to be a 100% offline, privacy-first desktop application for macOS (M-Series optimized via Metal). It captures the user's voice, transcribes it using Whisper, and polishes the transcription using a quantized local LLM (like TinyLlama or Phi-3).

## Architecture
- **Frameworks:** Electron + Vite (Vanilla TS, HTML, TailwindCSS)
- **Frontend (Renderer):** 
  - `src/main.ts`, `src/settings.ts`, `src/shortcuts.ts`
  - Uses Web Audio API (`src/audio-recorder.ts`) to capture 16kHz, 16-bit PCM chunks.
  - Sends chunks via IPC (`audio-chunk`) to the main process.
- **Backend (Main):**
  - `electron/main.ts`: Listens for `audio-stop`, builds a valid `.wav` file in the OS temp directory, and orchestrates the AI pipeline.
  - `electron/ai.ts`: The bridge to native C++ models. Uses `whisper-node` for Whisper.cpp and `node-llama-cpp` for LLaMA.cpp.
  - `electron/preload.ts`: Context bridge providing `window.electronAPI`.
- **Models:** Stored in `models/`. Download script located at `scripts/download-models.js`.

## Critical Rules for Agents
1. **Never use Cloud APIs:** The core requirement is that this runs strictly offline using local models. Do not add OpenAI, Anthropic, or external API dependencies for the AI features.
2. **ES Modules:** The project uses `"type": "module"`. When working in the Node.js backend (`electron/*`), remember that `__dirname` is not globally defined. Use the `import.meta.url` trick.
3. **Audio Handling:** Whisper.cpp strictly requires 16000Hz, 16-bit Mono WAV files. Do not change the `AudioContext` sample rate or the WAV header construction logic unless absolutely necessary.
4. **Tailwind Styling:** The UI is heavily customized with Tailwind classes and a custom color palette defined in the `<script id="tailwind-config">` inside the HTML files. Maintain the dark-mode, glassmorphic, and dynamic aesthetic. Do not use plain colors.
5. **No React/Vue/Svelte:** This project strictly uses Vanilla TypeScript and DOM manipulation for the frontend to keep it extremely lightweight and native-feeling.

## Context & Workflows
- **Debugging AI:** If the AI pipeline fails, first check if the models exist in the `models/` directory. Run `node scripts/download-models.js` if missing.
- **Modifying IPC:** When adding a new IPC channel, you must update `electron/main.ts` (the listener), `electron/preload.ts` (the exposed bridge), and `src/*.ts` (the consumer).

Keep the user's goals in mind: **Performance, Privacy, and Aesthetics.** Good luck!
