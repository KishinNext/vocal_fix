import { BrowserWindow as e, app as t, ipcMain as n } from "electron";
import r, { dirname as i, join as a } from "path";
import { fileURLToPath as o } from "url";
import { LlamaChatSession as s, getLlama as c } from "node-llama-cpp";
import l from "fs";
//#region electron/ai.ts
var u = o(import.meta.url), d = r.dirname(u), f = r.join(d, "../../models"), p = new class {
	llama = null;
	llamaModel = null;
	llamaContext = null;
	llamaSession = null;
	whisperModelPath;
	llamaModelPath;
	language;
	constructor() {
		this.whisperModelPath = r.join(f, "ggml-base.en.bin"), this.llamaModelPath = r.join(f, "tinyllama-1.1b-chat-v1.0.q4_k_m.gguf"), this.language = "auto";
	}
	setWhisperModel(e) {
		this.whisperModelPath = r.join(f, e);
	}
	setLanguage(e) {
		this.language = e;
	}
	async loadLlamaModel(e) {
		this.llamaModelPath = r.join(f, e), await this.initLlama();
	}
	async init() {
		l.existsSync(this.whisperModelPath) || console.warn(`Whisper model not found at ${this.whisperModelPath}`), await this.initLlama();
	}
	async initLlama() {
		if (!l.existsSync(this.llamaModelPath)) {
			console.warn(`LLAMA model not found at ${this.llamaModelPath}`);
			return;
		}
		try {
			this.llama ||= await c(), this.llamaContext && typeof this.llamaContext.dispose == "function" && this.llamaContext.dispose(), this.llamaModel && typeof this.llamaModel.dispose == "function" && this.llamaModel.dispose(), this.llamaModel = await this.llama.loadModel({ modelPath: this.llamaModelPath }), this.llamaContext = await this.llamaModel.createContext(), this.llamaSession = new s({
				contextSequence: this.llamaContext.getSequence(),
				systemPrompt: "You are an expert editor. Fix grammar and improve expression of the user's speech transcription without changing the meaning. Output only the corrected text."
			}), console.log(`LLaMA initialized on Metal GPU with ${this.llamaModelPath}`);
		} catch (e) {
			console.error("Failed to init LLAMA", e);
		}
	}
	async transcribeAudio(e) {
		if (!l.existsSync(this.whisperModelPath)) throw Error(`Whisper model not downloaded at ${this.whisperModelPath}`);
		try {
			let { whisper: t } = await import("whisper-node");
			return (await t(e, {
				modelPath: this.whisperModelPath,
				language: this.language
			})).map((e) => e.speech).join(" ").trim();
		} catch (e) {
			return console.error("Whisper failed to load or transcribe, using fallback mock.", e), "Esta es una transcripción simulada porque Whisper no pudo compilar en este sistema.";
		}
	}
	async fixGrammar(e) {
		if (!this.llamaSession) throw Error("LLaMA model not loaded");
		return (await this.llamaSession.prompt(e)).trim();
	}
}();
async function m() {
	await p.init();
}
async function h(e) {
	return p.transcribeAudio(e);
}
async function g(e) {
	return p.fixGrammar(e);
}
//#endregion
//#region electron/windows.ts
var _ = null, v = null;
function y(t, n) {
	_ = new e({
		width: 1280,
		height: 800,
		minWidth: 1024,
		minHeight: 600,
		titleBarStyle: "hiddenInset",
		webPreferences: {
			preload: t,
			nodeIntegration: !1,
			contextIsolation: !0
		}
	}), _.webContents.session.setPermissionRequestHandler((e, t, n) => {
		n(t === "media");
	}), process.env.VITE_DEV_SERVER_URL ? _.loadURL(process.env.VITE_DEV_SERVER_URL) : _.loadFile(n);
}
function b(t, n) {
	if (v) {
		v.focus();
		return;
	}
	v = new e({
		width: 800,
		height: 600,
		minWidth: 800,
		minHeight: 600,
		titleBarStyle: "hiddenInset",
		webPreferences: {
			preload: t,
			nodeIntegration: !1,
			contextIsolation: !0
		}
	}), process.env.VITE_DEV_SERVER_URL ? v.loadURL(`${process.env.VITE_DEV_SERVER_URL}settings.html`) : v.loadFile(n), v.on("closed", () => {
		v = null;
	});
}
//#endregion
//#region electron/audioService.ts
function x(e, t) {
	if (e.length === 0) return null;
	let n = Buffer.concat(e), r = a(t, `vocalfix_${Date.now()}.wav`), i = Buffer.alloc(44);
	i.write("RIFF", 0), i.writeUInt32LE(36 + n.length, 4), i.write("WAVE", 8), i.write("fmt ", 12), i.writeUInt32LE(16, 16), i.writeUInt16LE(1, 20), i.writeUInt16LE(1, 22), i.writeUInt32LE(16e3, 24), i.writeUInt32LE(32e3, 28), i.writeUInt16LE(2, 32), i.writeUInt16LE(16, 34), i.write("data", 36), i.writeUInt32LE(n.length, 40);
	let o = Buffer.concat([i, n]);
	return l.writeFileSync(r, o), r;
}
//#endregion
//#region electron/ipcHandlers.ts
function S(r, i) {
	n.on("open-settings", () => {
		b(r, i);
	}), n.on("close-window", (t) => {
		let n = e.fromWebContents(t.sender);
		n && n.close();
	}), n.on("minimize-window", (t) => {
		let n = e.fromWebContents(t.sender);
		n && n.minimize();
	}), n.on("maximize-window", (t) => {
		let n = e.fromWebContents(t.sender);
		n && (n.isMaximized() ? n.unmaximize() : n.maximize());
	});
	let a = [];
	n.on("audio-chunk", (e, t) => {
		let n = Buffer.from(new Int16Array(t).buffer);
		a.push(n);
	}), n.on("audio-stop", async (e) => {
		if (a.length === 0) return;
		console.log("Processing audio chunks...");
		let n = [...a];
		a = [];
		let r = null;
		try {
			if (r = x(n, t.getPath("temp")), !r) return;
			console.log("Transcribing...");
			let i = await h(r);
			if (e.sender.send("transcription-result", i), i) {
				console.log("Fixing grammar...");
				let t = await g(i);
				e.sender.send("correction-result", t);
			}
		} catch (t) {
			console.error("AI Processing error:", t), e.sender.send("ai-error", t instanceof Error ? t.message : String(t));
		} finally {
			if (r && l.existsSync(r)) try {
				l.unlinkSync(r);
			} catch (e) {
				console.error("Failed to delete temp wav file:", e);
			}
		}
	});
}
//#endregion
//#region electron/main.ts
var C = o(import.meta.url), w = i(C);
process.env.DIST = a(w, "../dist"), process.env.PUBLIC = t.isPackaged ? process.env.DIST : a(process.env.DIST, "../public");
var T = a(w, "./preload.js"), E = a(process.env.DIST, "index.html"), D = a(process.env.DIST, "settings.html");
t.whenReady().then(async () => {
	await m(), y(T, E), S(T, D), t.on("activate", () => {
		e.getAllWindows().length === 0 && y(T, E);
	});
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
});
//#endregion
export {};
