// Captures the microphone as 16 kHz mono PCM (what whisper expects). The AudioContext
// resamples whatever the device delivers (e.g. 48 kHz stereo) and mixes it down.
const SAMPLE_RATE = 16000
// The worklet yields 128-sample blocks (~8ms); batching them keeps IPC to ~10 messages/s
const BATCH_SAMPLES = SAMPLE_RATE / 10
// The level meter gets the loudest of every 8 blocks (~64ms)
const LEVEL_BLOCKS = 8

function rms(block: Int16Array): number {
  let sum = 0
  for (const sample of block) sum += (sample / 32768) ** 2
  return Math.sqrt(sum / block.length)
}

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private currentDeviceId: string | undefined = undefined;
  private starting: Promise<void> | null = null;
  private batch: Int16Array[] = [];
  private batchSamples = 0;
  private onData: ((pcm: Int16Array) => void) | null = null;
  private onLevel: ((rms: number) => void) | null = null;
  private levelPeak = 0;
  private levelBlocks = 0;

  async getMicrophones(): Promise<MediaDeviceInfo[]> {
    try {
      // Device labels need permission; close that stream so the mic isn't left open
      const permission = await navigator.mediaDevices.getUserMedia({ audio: true });
      permission.getTracks?.().forEach(track => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (e) {
      console.error('Microphone access denied', e);
      return [];
    }
  }

  setMicrophone(deviceId: string) {
    this.currentDeviceId = deviceId;
  }

  // onLevel receives the microphone level (RMS in [0, 1]) about 15 times a second
  startRecording(onData: (pcm: Int16Array) => void, onLevel?: (rms: number) => void): Promise<void> {
    this.onData = onData;
    this.onLevel = onLevel ?? null;
    this.levelPeak = 0;
    this.levelBlocks = 0;
    this.batch = [];
    this.batchSamples = 0;
    this.starting = this.open().finally(() => { this.starting = null; });
    return this.starting;
  }

  private async open() {
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    };
    if (this.currentDeviceId) {
      audioConstraints.deviceId = { exact: this.currentDeviceId };
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    await this.audioContext.audioWorklet.addModule('/audio-processor.js');

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
    this.workletNode.port.onmessage = (e: MessageEvent<Int16Array>) => this.collect(e.data);

    this.source.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
  }

  private collect(block: Int16Array) {
    this.batch.push(block);
    this.levelPeak = Math.max(this.levelPeak, rms(block));
    if (++this.levelBlocks >= LEVEL_BLOCKS) {
      this.onLevel?.(this.levelPeak);
      this.levelPeak = 0;
      this.levelBlocks = 0;
    }
    this.batchSamples += block.length;
    if (this.batchSamples >= BATCH_SAMPLES) this.flush();
  }

  private flush() {
    if (this.batchSamples === 0) return;
    const pcm = new Int16Array(this.batchSamples);
    let offset = 0;
    for (const block of this.batch) {
      pcm.set(block, offset);
      offset += block.length;
    }
    this.batch = [];
    this.batchSamples = 0;
    this.onData?.(pcm);
  }

  // Sends the audio still batched, so nothing said right before stopping is lost
  async stopRecording() {
    await this.starting?.catch(() => undefined); // a stop during start must still close the stream
    if (this.workletNode) this.workletNode.port.onmessage = null;
    this.workletNode?.disconnect();
    this.source?.disconnect();
    await this.audioContext?.close();
    this.stream?.getTracks().forEach(track => track.stop());
    this.flush();
    this.onData = null;
    this.onLevel = null;
    this.workletNode = null;
    this.source = null;
    this.audioContext = null;
    this.stream = null;
  }
}
