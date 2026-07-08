// AudioWorklet processor that streams raw mono Float32 PCM blocks to the main thread.
// Replaces the deprecated ScriptProcessorNode. Registered as 'pcm-recorder'.
class PCMRecorder extends AudioWorkletProcessor {
    process(inputs) {
        const input = inputs[0];
        // input[0] is a Float32Array of the first channel (128 frames per block).
        if (input && input[0]) {
            // Copy — the underlying buffer is reused by the engine after process() returns.
            this.port.postMessage(input[0].slice(0));
        }
        // Keep the processor alive as long as the node is connected.
        return true;
    }
}

registerProcessor('pcm-recorder', PCMRecorder);
