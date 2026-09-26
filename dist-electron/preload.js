import { contextBridge as e, ipcRenderer as t } from "electron";
//#region electron/preload.ts
e.exposeInMainWorld("electronAPI", {
	openSettings: () => t.send("open-settings"),
	closeWindow: () => t.send("close-window"),
	minimizeWindow: () => t.send("minimize-window"),
	maximizeWindow: () => t.send("maximize-window"),
	getModels: () => t.invoke("get-models"),
	sendAudioChunk: (e) => t.send("audio-chunk", e),
	sendAudioStop: () => t.send("audio-stop"),
	onTranscription: (e) => {
		let n = (t, n) => e(n);
		return t.on("transcription-result", n), () => t.removeListener("transcription-result", n);
	},
	onCorrection: (e) => {
		let n = (t, n) => e(n);
		return t.on("correction-result", n), () => t.removeListener("correction-result", n);
	},
	onAiError: (e) => {
		let n = (t, n) => e(n);
		return t.on("ai-error", n), () => t.removeListener("ai-error", n);
	},
	onMemoryStats: (e) => {
		let n = (t, n) => e(n);
		return t.on("memory-stats", n), () => t.removeListener("memory-stats", n);
	}
});
//#endregion
export {};
