import { contextBridge, ipcRenderer } from "electron";
//#region electron/preload.ts
contextBridge.exposeInMainWorld("electronAPI", {
	openSettings: () => ipcRenderer.send("open-settings"),
	closeWindow: () => ipcRenderer.send("close-window"),
	minimizeWindow: () => ipcRenderer.send("minimize-window"),
	maximizeWindow: () => ipcRenderer.send("maximize-window"),
	sendAudioChunk: (pcmData) => ipcRenderer.send("audio-chunk", pcmData),
	sendAudioStop: () => ipcRenderer.send("audio-stop"),
	onTranscription: (callback) => {
		const listener = (_event, value) => callback(value);
		ipcRenderer.on("transcription-result", listener);
		return () => ipcRenderer.removeListener("transcription-result", listener);
	},
	onCorrection: (callback) => {
		const listener = (_event, value) => callback(value);
		ipcRenderer.on("correction-result", listener);
		return () => ipcRenderer.removeListener("correction-result", listener);
	},
	onAiError: (callback) => {
		const listener = (_event, value) => callback(value);
		ipcRenderer.on("ai-error", listener);
		return () => ipcRenderer.removeListener("ai-error", listener);
	},
	onMemoryStats: (callback) => {
		const listener = (_event, value) => callback(value);
		ipcRenderer.on("memory-stats", listener);
		return () => ipcRenderer.removeListener("memory-stats", listener);
	}
});
//#endregion
export {};
