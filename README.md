# VocalFix

VocalFix is a local, privacy-first Electron application designed to act as your intelligent voice assistant and natural expression editor. It records your speech, transcribes it completely offline, and automatically corrects your grammar and style using localized AI models.

## Features
- **100% Offline & Private:** No cloud APIs. Audio and text never leave your machine.
- **Streaming dictation:** No need to pause: text is transcribed while you speak, and each sentence gets a grammar review and a natural rewrite as soon as you pause.
- **Whisper.cpp Integration:** Fast transcription using local Whisper models (the whisper.cpp server keeps the model loaded).
- **macOS and Windows:** Metal acceleration on Apple Silicon; CPU on Windows.
- **LLaMA.cpp Integration:** Hardware-accelerated (Apple Silicon Metal) grammar and style correction using quantized LLM models (e.g., TinyLlama, Phi-3).
- **Beautiful UI:** Tailor-made with modern TailwindCSS, featuring a clean layout and dynamic micro-animations.

## Download

Installers are published on the [Releases page](https://github.com/KishinNext/vocal_fix/releases/latest):

| System | File |
| --- | --- |
| macOS (Apple Silicon) | `VocalFix-<version>-arm64.dmg` |
| Windows 10/11 (64-bit) | `VocalFix Setup <version>.exe` |

The installers are not signed with a developer certificate, so both systems warn the first time:

- **macOS:** drag VocalFix to Applications. If macOS says the app is damaged or cannot be opened, run
  `xattr -cr /Applications/VocalFix.app` once in Terminal and open it again.
- **Windows:** on the SmartScreen dialog choose **More info → Run anyway**.

After installing, open **Ajustes → Modelos Locales** and download one Whisper model and one LLM.
Models are not bundled: they are downloaded to your machine on first use.

## Tech Stack
- **Frontend:** Vanilla TypeScript, HTML, TailwindCSS
- **Backend:** Electron, Node.js
- **AI Core:** whisper.cpp server (Speech-to-Text, sources vendored by `whisper-node`), `node-llama-cpp` (LLM)
- **Bundler:** Vite + Vite-Electron

## Getting Started (development)

1. **Install Dependencies:**
   ```bash
   npm install
   npm run whisper:build   # compiles the whisper.cpp server
   ```
   - **macOS:** needs Xcode or the Command Line Tools.
   - **Windows:** needs Visual Studio Build Tools (C++ workload) and CMake.

2. **Run the App:**
   ```bash
   npm run dev
   ```

3. **Download AI Models:**
   Open **Ajustes → Modelos Locales** and download one Whisper model (speech-to-text) and one LLM (grammar & style).
   Each model shows disk space and approximate RAM so you can pick one that fits your machine.

## Building the installers

```bash
npm run dist   # writes the .dmg (on macOS) or the .exe (on Windows) to release/
```

Each installer has to be built on its own system. The `Build installers` GitHub Actions workflow
(`.github/workflows/build.yml`) builds both:

- **Manual run:** Actions tab → Build installers → Run workflow, then download the artifacts from the run.
- **Release:** push a tag such as `v0.1.0`; the installers are attached to a GitHub Release.

## Architecture
- `electron/main.ts`: The main process. Handles window management and wires IPC.
- `electron/streamSession.ts`: Streaming pipeline: voice activity detection (`speechSegmenter.ts`), transcription (`whisperServer.ts`), grammar review and natural expression (`ai.ts`).
- `electron/llmWorker.ts`: Runs the LLM in a utility process so model loading never freezes the app.
- `src/`: The renderer process. Contains UI logic and the `audio-recorder.ts` utility for capturing microphone streams via the Web Audio API.
