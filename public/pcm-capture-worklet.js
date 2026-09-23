// Mic capture processor for SIYA's Gemini Live pipeline.
// Runs on the dedicated audio rendering thread, not the main thread, so it
// keeps producing frames on schedule even when the main thread is busy
// (e.g. heavy 3D/software rendering) -- unlike the deprecated
// ScriptProcessorNode, which processes on the main thread and can silently
// drop callbacks under load. Batches 128-sample render quanta into 1024-
// sample frames to match the frame size the rest of the pipeline expects
// (voiceThreshold/voiceStartFrames tuning, Gemini chunk size).
const FRAME_SIZE = 1024;

class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(FRAME_SIZE);
    this._offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (!channel || channel.length === 0) return true;

    let read = 0;
    while (read < channel.length) {
      const remaining = FRAME_SIZE - this._offset;
      const take = Math.min(remaining, channel.length - read);
      this._buffer.set(channel.subarray(read, read + take), this._offset);
      this._offset += take;
      read += take;
      if (this._offset === FRAME_SIZE) {
        const frame = this._buffer.slice(0);
        this.port.postMessage(frame, [frame.buffer]);
        this._offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-capture-processor", PCMCaptureProcessor);
