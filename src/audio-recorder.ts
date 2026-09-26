export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;
  private currentDeviceId: string | undefined = undefined;

  async getMicrophones(): Promise<MediaDeviceInfo[]> {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }); // Request permission first
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

  async startRecording(onData: (pcmBuffer: Int16Array) => void) {
    const audioConstraints: any = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };
    if (this.currentDeviceId) {
      audioConstraints.deviceId = { exact: this.currentDeviceId };
    }
    
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
    
    // Whisper requires exactly 16000Hz sample rate
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    
    await this.audioContext.audioWorklet.addModule('/audio-processor.js');

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
    this.workletNode.port.onmessage = (e) => {
      if (this.isRecording) {
        onData(e.data);
      }
    };

    this.source.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  stopRecording() {
    this.isRecording = false;
    this.workletNode?.disconnect();
    this.source?.disconnect();
    this.audioContext?.close();
    this.stream?.getTracks().forEach(track => track.stop());
  }
}
