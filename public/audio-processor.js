class PCMProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const inputData = input[0];
      const int16Data = new Int16Array(inputData.length);
      
      for (let i = 0; i < inputData.length; i++) {
        let s = Math.max(-1, Math.min(1, inputData[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      this.port.postMessage(int16Data);
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
