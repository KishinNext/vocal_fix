import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MODELS_DIR = path.join(__dirname, '../models')

if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true })
}

const models = [
  {
    name: 'ggml-base.en.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin'
  },
  {
    name: 'tinyllama-1.1b-chat-v1.0.q4_k_m.gguf',
    url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.q4_k_m.gguf'
  }
]

async function downloadModel(model) {
  const destPath = path.join(MODELS_DIR, model.name)
  if (fs.existsSync(destPath)) {
    console.log(`${model.name} already exists.`)
    return
  }

  console.log(`Downloading ${model.name}...`)
  const response = await fetch(model.url)
  if (!response.ok) throw new Error(`Unexpected response ${response.statusText}`)

  const fileStream = fs.createWriteStream(destPath)
  // fetch body is a web stream, need to adapt if not supported, but Node.js 18+ supports it
  await pipeline(response.body, fileStream)
  console.log(`${model.name} downloaded successfully!`)
}

async function main() {
  for (const model of models) {
    try {
      await downloadModel(model)
    } catch (e) {
      console.error(`Failed to download ${model.name}:`, e)
    }
  }
}

main()
