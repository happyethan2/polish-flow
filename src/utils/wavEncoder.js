// Audio post-processing: merge raw PCM blocks, resample to 16 kHz, and encode to WAV.
//
// 16 kHz mono is the native speech format for Gemini/Whisper-class models, so we target it
// deliberately. Resampling is done via OfflineAudioContext (browser-quality, properly
// anti-aliased) rather than naive averaging, which previously introduced artifacts.

const TARGET_SAMPLE_RATE = 16000;

/**
 * Merge recorded Float32 blocks, resample to 16 kHz, and encode as a WAV Blob.
 * Async because OfflineAudioContext rendering is promise-based.
 * @param {Float32Array[]} recordedBuffers
 * @param {number} recordingLength total sample count across all buffers
 * @param {number} inputSampleRate sample rate the audio was captured at
 * @returns {Promise<Blob>} audio/wav blob (16 kHz, 16-bit, mono)
 */
export async function processRecordedAudio(recordedBuffers, recordingLength, inputSampleRate) {
    const flatBuffer = mergeBuffers(recordedBuffers, recordingLength);
    const downsampled = await resampleBuffer(flatBuffer, inputSampleRate, TARGET_SAMPLE_RATE);
    return encodeWAV(downsampled);
}

function mergeBuffers(buffers, len) {
    const result = new Float32Array(len);
    let offset = 0;
    for (let i = 0; i < buffers.length; i++) {
        result.set(buffers[i], offset);
        offset += buffers[i].length;
    }
    return result;
}

/**
 * Resample using OfflineAudioContext for high-quality, anti-aliased conversion.
 * Falls back to the input buffer when no resampling is needed or the sample count is too small.
 */
async function resampleBuffer(buffer, inputSampleRate, outSampleRate) {
    if (!buffer.length || inputSampleRate === outSampleRate) {
        return buffer;
    }
    if (outSampleRate > inputSampleRate) {
        console.warn('Target sample rate is higher than source. Returning original buffer.');
        return buffer;
    }

    const frameCount = Math.max(1, Math.round(buffer.length * (outSampleRate / inputSampleRate)));
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const offline = new OfflineCtx(1, frameCount, outSampleRate);

    const source = offline.createBuffer(1, buffer.length, inputSampleRate);
    source.getChannelData(0).set(buffer);

    const node = offline.createBufferSource();
    node.buffer = source;
    node.connect(offline.destination);
    node.start(0);

    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
}

export function encodeWAV(samples) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM (linear quantization)
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, TARGET_SAMPLE_RATE, true);
    view.setUint32(28, TARGET_SAMPLE_RATE * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    floatTo16BitPCM(view, 44, samples);

    return new Blob([view], { type: 'audio/wav' });
}

function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        // Convert float [-1.0, 1.0] to int16 [-32768, 32767]
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
