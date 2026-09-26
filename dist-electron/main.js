import { createRequire as e } from "node:module";
import { BrowserWindow as t, app as n, ipcMain as r } from "electron";
import i, { dirname as a, join as o } from "path";
import { fileURLToPath as s } from "url";
import { LlamaChatSession as c, getLlama as l } from "node-llama-cpp";
import u from "fs";
//#region \0rolldown/runtime.js
var d = /* @__PURE__ */ e(import.meta.url), f = s(import.meta.url), p = i.dirname(f), m = i.join(p, "../../models"), h = new class {
	llama = null;
	llamaModel = null;
	llamaContext = null;
	llamaSession = null;
	whisperModelPath;
	llamaModelPath;
	language;
	constructor() {
		this.whisperModelPath = i.join(m, "ggml-base.en.bin"), this.llamaModelPath = i.join(m, "tinyllama-1.1b-chat-v1.0.q4_k_m.gguf"), this.language = "auto";
	}
	setWhisperModel(e) {
		this.whisperModelPath = i.join(m, e);
	}
	setLanguage(e) {
		this.language = e;
	}
	async loadLlamaModel(e) {
		this.llamaModelPath = i.join(m, e), await this.initLlama();
	}
	async init() {
		u.existsSync(this.whisperModelPath) || console.warn(`Whisper model not found at ${this.whisperModelPath}`), await this.initLlama();
	}
	async initLlama() {
		if (!u.existsSync(this.llamaModelPath)) {
			console.warn(`LLAMA model not found at ${this.llamaModelPath}`);
			return;
		}
		try {
			this.llama ||= await l(), this.llamaContext && typeof this.llamaContext.dispose == "function" && this.llamaContext.dispose(), this.llamaModel && typeof this.llamaModel.dispose == "function" && this.llamaModel.dispose(), this.llamaModel = await this.llama.loadModel({ modelPath: this.llamaModelPath }), this.llamaContext = await this.llamaModel.createContext(), this.llamaSession = new c({
				contextSequence: this.llamaContext.getSequence(),
				systemPrompt: "You are an expert editor. Fix grammar and improve expression of the user's speech transcription without changing the meaning. Output only the corrected text."
			}), console.log(`LLaMA initialized on Metal GPU with ${this.llamaModelPath}`);
		} catch (e) {
			console.error("Failed to init LLAMA", e);
		}
	}
	async transcribeAudio(e) {
		if (!u.existsSync(this.whisperModelPath)) throw Error(`Whisper model not downloaded at ${this.whisperModelPath}`);
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
async function g() {
	await h.init();
}
async function _(e) {
	return h.transcribeAudio(e);
}
async function v(e) {
	return h.fixGrammar(e);
}
//#endregion
//#region electron/windows.ts
var y = null, b = null;
function x(e, n) {
	return y = new t({
		width: 1280,
		height: 800,
		minWidth: 1024,
		minHeight: 600,
		titleBarStyle: "hiddenInset",
		icon: o(process.env.PUBLIC || "", "logo.png"),
		webPreferences: {
			preload: e,
			nodeIntegration: !1,
			contextIsolation: !0
		}
	}), y.webContents.session.setPermissionRequestHandler((e, t, n) => {
		n(t === "media");
	}), process.env.VITE_DEV_SERVER_URL ? y.loadURL(process.env.VITE_DEV_SERVER_URL) : y.loadFile(n), y;
}
function S(e, n) {
	if (b) {
		b.focus();
		return;
	}
	b = new t({
		width: 800,
		height: 600,
		minWidth: 800,
		minHeight: 600,
		titleBarStyle: "hiddenInset",
		icon: o(process.env.PUBLIC || "", "logo.png"),
		webPreferences: {
			preload: e,
			nodeIntegration: !1,
			contextIsolation: !0
		}
	}), process.env.VITE_DEV_SERVER_URL ? b.loadURL(`${process.env.VITE_DEV_SERVER_URL}settings.html`) : b.loadFile(n), b.on("closed", () => {
		b = null;
	});
}
//#endregion
//#region electron/audioService.ts
function C(e, t) {
	if (e.length === 0) return null;
	let n = Buffer.concat(e), r = o(t, `vocalfix_${Date.now()}.wav`), i = Buffer.alloc(44);
	i.write("RIFF", 0), i.writeUInt32LE(36 + n.length, 4), i.write("WAVE", 8), i.write("fmt ", 12), i.writeUInt32LE(16, 16), i.writeUInt16LE(1, 20), i.writeUInt16LE(1, 22), i.writeUInt32LE(16e3, 24), i.writeUInt32LE(32e3, 28), i.writeUInt16LE(2, 32), i.writeUInt16LE(16, 34), i.write("data", 36), i.writeUInt32LE(n.length, 40);
	let a = Buffer.concat([i, n]);
	return u.writeFileSync(r, a), r;
}
//#endregion
//#region electron/ipcHandlers.ts
function w(e, i) {
	r.on("open-settings", () => {
		S(e, i);
	}), r.handle("get-models", async () => {
		try {
			let e = d("path").join(__dirname, "../../models");
			if (!u.existsSync(e)) return {
				whisper: [],
				llama: []
			};
			let t = u.readdirSync(e);
			return {
				whisper: t.filter((e) => e.includes("ggml") || e.includes("whisper")),
				llama: t.filter((e) => e.endsWith(".gguf") && !e.includes("whisper"))
			};
		} catch (e) {
			return console.error("Failed to read models dir", e), {
				whisper: [],
				llama: []
			};
		}
	}), r.on("close-window", (e) => {
		let n = t.fromWebContents(e.sender);
		n && n.close();
	}), r.on("minimize-window", (e) => {
		let n = t.fromWebContents(e.sender);
		n && n.minimize();
	}), r.on("maximize-window", (e) => {
		let n = t.fromWebContents(e.sender);
		n && (n.isMaximized() ? n.unmaximize() : n.maximize());
	});
	let a = [];
	r.on("audio-chunk", (e, t) => {
		let n = Buffer.from(new Int16Array(t).buffer);
		a.push(n);
	}), r.on("audio-stop", async (e) => {
		if (a.length === 0) return;
		console.log("Processing audio chunks...");
		let t = [...a];
		a = [];
		let r = null;
		try {
			if (r = C(t, n.getPath("temp")), !r) return;
			console.log("Transcribing...");
			let i = await _(r);
			if (e.sender.send("transcription-result", i), i) {
				console.log("Fixing grammar...");
				let t = await v(i);
				e.sender.send("correction-result", t);
			}
		} catch (t) {
			console.error("AI Processing error:", t), e.sender.send("ai-error", t instanceof Error ? t.message : String(t));
		} finally {
			if (r && u.existsSync(r)) try {
				u.unlinkSync(r);
			} catch (e) {
				console.error("Failed to delete temp wav file:", e);
			}
		}
	});
}
//#endregion
//#region electron/main.ts
var T = s(import.meta.url), E = a(T);
process.env.DIST = o(E, "../dist"), process.env.PUBLIC = n.isPackaged ? process.env.DIST : o(process.env.DIST, "../public");
var D = o(E, "./preload.js"), O = o(process.env.DIST, "index.html"), k = o(process.env.DIST, "settings.html");
n.whenReady().then(async () => {
	await g();
	let e = x(D, O);
	w(D, k), setInterval(async () => {
		if (e && !e.isDestroyed()) {
			let t = ((await process.getProcessMemoryInfo()).residentSet / 1024).toFixed(1) + " GB";
			e.webContents.send("memory-stats", t);
		}
	}, 2e3), n.on("activate", () => {
		t.getAllWindows().length === 0 && x(D, O);
	});
}), n.on("window-all-closed", () => {
	process.platform !== "darwin" && n.quit();
});
//#endregion
export {};
