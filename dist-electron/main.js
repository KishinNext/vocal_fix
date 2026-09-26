import { createRequire } from "node:module";
import { BrowserWindow, app, ipcMain } from "electron";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";
import { LlamaChatSession, getLlama } from "node-llama-cpp";
import fs from "fs";
//#region \0rolldown/runtime.js
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region electron/ai.ts
var __filename$1 = fileURLToPath(import.meta.url);
var __dirname$2 = path.dirname(__filename$1);
var MODELS_DIR = path.join(__dirname$2, "../../models");
var AIManager = class {
	llama = null;
	llamaModel = null;
	llamaContext = null;
	llamaSession = null;
	whisperModelPath;
	llamaModelPath;
	language;
	constructor() {
		this.whisperModelPath = path.join(MODELS_DIR, "ggml-base.en.bin");
		this.llamaModelPath = path.join(MODELS_DIR, "tinyllama-1.1b-chat-v1.0.q4_k_m.gguf");
		this.language = "auto";
	}
	setWhisperModel(modelName) {
		this.whisperModelPath = path.join(MODELS_DIR, modelName);
	}
	setLanguage(lang) {
		this.language = lang;
	}
	async loadLlamaModel(modelName) {
		this.llamaModelPath = path.join(MODELS_DIR, modelName);
		await this.initLlama();
	}
	async init() {
		if (!fs.existsSync(this.whisperModelPath)) console.warn(`Whisper model not found at ${this.whisperModelPath}`);
		await this.initLlama();
	}
	async initLlama() {
		if (!fs.existsSync(this.llamaModelPath)) {
			console.warn(`LLAMA model not found at ${this.llamaModelPath}`);
			return;
		}
		try {
			if (!this.llama) this.llama = await getLlama();
			if (this.llamaContext && typeof this.llamaContext.dispose === "function") this.llamaContext.dispose();
			if (this.llamaModel && typeof this.llamaModel.dispose === "function") this.llamaModel.dispose();
			this.llamaModel = await this.llama.loadModel({ modelPath: this.llamaModelPath });
			this.llamaContext = await this.llamaModel.createContext();
			this.llamaSession = new LlamaChatSession({
				contextSequence: this.llamaContext.getSequence(),
				systemPrompt: "You are an expert editor. Fix grammar and improve expression of the user's speech transcription without changing the meaning. Output only the corrected text."
			});
			console.log(`LLaMA initialized on Metal GPU with ${this.llamaModelPath}`);
		} catch (e) {
			console.error("Failed to init LLAMA", e);
		}
	}
	async transcribeAudio(wavFilePath) {
		if (!fs.existsSync(this.whisperModelPath)) throw new Error(`Whisper model not downloaded at ${this.whisperModelPath}`);
		try {
			const { whisper } = await import("whisper-node");
			return (await whisper(wavFilePath, {
				modelPath: this.whisperModelPath,
				language: this.language
			})).map((r) => r.speech).join(" ").trim();
		} catch (e) {
			console.error("Whisper failed to load or transcribe, using fallback mock.", e);
			return "Esta es una transcripción simulada porque Whisper no pudo compilar en este sistema.";
		}
	}
	async fixGrammar(text) {
		if (!this.llamaSession) throw new Error("LLaMA model not loaded");
		return (await this.llamaSession.prompt(text)).trim();
	}
};
var aiManager = new AIManager();
async function initAI() {
	await aiManager.init();
}
async function transcribeAudio(wavFilePath) {
	return aiManager.transcribeAudio(wavFilePath);
}
async function fixGrammar(text) {
	return aiManager.fixGrammar(text);
}
//#endregion
//#region electron/windows.ts
var win = null;
var settingsWin = null;
function createWindow(preload, indexHtml) {
	win = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 1024,
		minHeight: 600,
		titleBarStyle: "hiddenInset",
		icon: join(process.env.PUBLIC || "", "logo.png"),
		webPreferences: {
			preload,
			nodeIntegration: false,
			contextIsolation: true
		}
	});
	win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
		if (permission === "media") callback(true);
		else callback(false);
	});
	if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
	else win.loadFile(indexHtml);
	return win;
}
function createSettingsWindow(preload, settingsHtml) {
	if (settingsWin) {
		settingsWin.focus();
		return;
	}
	settingsWin = new BrowserWindow({
		width: 800,
		height: 600,
		minWidth: 800,
		minHeight: 600,
		titleBarStyle: "hiddenInset",
		icon: join(process.env.PUBLIC || "", "logo.png"),
		webPreferences: {
			preload,
			nodeIntegration: false,
			contextIsolation: true
		}
	});
	if (process.env.VITE_DEV_SERVER_URL) {
		const baseUrl = process.env.VITE_DEV_SERVER_URL;
		const url = baseUrl.endsWith("/") ? `${baseUrl}settings.html` : `${baseUrl}/settings.html`;
		settingsWin.loadURL(url);
	} else settingsWin.loadFile(settingsHtml);
	settingsWin.on("closed", () => {
		settingsWin = null;
	});
}
//#endregion
//#region electron/audioService.ts
function saveWavFile(audioChunks, tempDir) {
	if (audioChunks.length === 0) return null;
	const totalBuffer = Buffer.concat(audioChunks);
	const wavPath = join(tempDir, `vocalfix_${Date.now()}.wav`);
	const header = Buffer.alloc(44);
	header.write("RIFF", 0);
	header.writeUInt32LE(36 + totalBuffer.length, 4);
	header.write("WAVE", 8);
	header.write("fmt ", 12);
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(1, 22);
	header.writeUInt32LE(16e3, 24);
	header.writeUInt32LE(32e3, 28);
	header.writeUInt16LE(2, 32);
	header.writeUInt16LE(16, 34);
	header.write("data", 36);
	header.writeUInt32LE(totalBuffer.length, 40);
	const wavBuffer = Buffer.concat([header, totalBuffer]);
	fs.writeFileSync(wavPath, wavBuffer);
	return wavPath;
}
//#endregion
//#region electron/ipcHandlers.ts
function registerIpcHandlers(preload, settingsHtml) {
	ipcMain.on("open-settings", () => {
		createSettingsWindow(preload, settingsHtml);
	});
	ipcMain.handle("get-models", async () => {
		try {
			const modelsDir = __require("path").join(__dirname, "../../models");
			if (!fs.existsSync(modelsDir)) return {
				whisper: [],
				llama: []
			};
			const files = fs.readdirSync(modelsDir);
			return {
				whisper: files.filter((f) => f.includes("ggml") || f.includes("whisper")),
				llama: files.filter((f) => f.endsWith(".gguf") && !f.includes("whisper"))
			};
		} catch (e) {
			console.error("Failed to read models dir", e);
			return {
				whisper: [],
				llama: []
			};
		}
	});
	ipcMain.on("close-window", (event) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (window) window.close();
	});
	ipcMain.on("minimize-window", (event) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (window) window.minimize();
	});
	ipcMain.on("maximize-window", (event) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (window) {
			if (window.isMaximized()) window.unmaximize();
			else window.maximize();
		}
	});
	let audioChunks = [];
	ipcMain.on("audio-chunk", (event, pcmData) => {
		const buf = Buffer.from(new Int16Array(pcmData).buffer);
		audioChunks.push(buf);
	});
	ipcMain.on("audio-stop", async (event) => {
		if (audioChunks.length === 0) return;
		console.log("Processing audio chunks...");
		const chunksToProcess = [...audioChunks];
		audioChunks = [];
		let wavPath = null;
		try {
			wavPath = saveWavFile(chunksToProcess, app.getPath("temp"));
			if (!wavPath) return;
			console.log("Transcribing...");
			const transcription = await transcribeAudio(wavPath);
			event.sender.send("transcription-result", transcription);
			if (transcription) {
				console.log("Fixing grammar...");
				const corrected = await fixGrammar(transcription);
				event.sender.send("correction-result", corrected);
			}
		} catch (e) {
			console.error("AI Processing error:", e);
			event.sender.send("ai-error", e instanceof Error ? e.message : String(e));
		} finally {
			if (wavPath && fs.existsSync(wavPath)) try {
				fs.unlinkSync(wavPath);
			} catch (unlinkErr) {
				console.error("Failed to delete temp wav file:", unlinkErr);
			}
		}
	});
}
//#endregion
//#region electron/main.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname$1 = dirname(__filename);
process.env.DIST = join(__dirname$1, "../dist");
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, "../public");
var preload = join(__dirname$1, "./preload.js");
var indexHtml = join(process.env.DIST, "index.html");
var settingsHtml = join(process.env.DIST, "settings.html");
app.setName("VocalFix");
if (process.platform === "darwin") app.dock.setIcon(join(process.env.PUBLIC || "", "logo.png"));
app.whenReady().then(async () => {
	await initAI();
	const mainWindow = createWindow(preload, indexHtml);
	registerIpcHandlers(preload, settingsHtml);
	setInterval(async () => {
		if (mainWindow && !mainWindow.isDestroyed()) {
			const memoryGB = ((await process.getProcessMemoryInfo()).residentSet / 1024).toFixed(1) + " GB";
			mainWindow.webContents.send("memory-stats", memoryGB);
		}
	}, 2e3);
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow(preload, indexHtml);
	});
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
//#endregion
export {};
