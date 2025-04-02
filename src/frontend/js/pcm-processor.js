/**
 * pcm-processor.js
 * 
 * AudioWorkletProcessor to convert Float32 audio data to Int16 PCM
 * and post it back to the main thread.
 */
class PcmProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // Optional: Add any initialization logic here
    }

    process(inputs, outputs, parameters) {
        // inputs[0][0] contains the Float32Array data for the first channel of the first input.
        const inputChannelData = inputs[0][0];

        if (!inputChannelData || inputChannelData.length === 0) {
            // No data to process, continue to keep the processor alive
            return true; 
        }

        // Convert Float32Array (-1.0 to 1.0) to Int16Array (-32768 to 32767)
        const buffer = new ArrayBuffer(inputChannelData.length * 2); // 2 bytes per Int16
        const view = new DataView(buffer);
        for (let i = 0; i < inputChannelData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputChannelData[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // true for little-endian
        }

        // Post the ArrayBuffer containing raw PCM data back to the main thread
        this.port.postMessage(buffer);

        // Return true to keep the processor alive
        return true;
    }
}

registerProcessor('pcm-processor', PcmProcessor);
