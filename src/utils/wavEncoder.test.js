import { describe, it, expect } from 'vitest';
import { encodeWAV, processRecordedAudio } from './wavEncoder';

const readHeader = async (blob) => {
    const buf = await blob.arrayBuffer();
    const view = new DataView(buf);
    const str = (off, len) => String.fromCharCode(...new Uint8Array(buf, off, len));
    return {
        riff: str(0, 4),
        wave: str(8, 4),
        fmt: str(12, 4),
        audioFormat: view.getUint16(20, true),
        channels: view.getUint16(22, true),
        sampleRate: view.getUint32(24, true),
        bitsPerSample: view.getUint16(34, true),
        dataTag: str(36, 4),
        dataLen: view.getUint32(40, true),
        byteLength: buf.byteLength,
    };
};

describe('encodeWAV', () => {
    it('writes a valid 16 kHz / 16-bit / mono WAV header', async () => {
        const h = await readHeader(encodeWAV(new Float32Array(160)));
        expect(h.riff).toBe('RIFF');
        expect(h.wave).toBe('WAVE');
        expect(h.fmt).toBe('fmt ');
        expect(h.audioFormat).toBe(1); // PCM
        expect(h.channels).toBe(1);
        expect(h.sampleRate).toBe(16000);
        expect(h.bitsPerSample).toBe(16);
        expect(h.dataTag).toBe('data');
        expect(h.dataLen).toBe(160 * 2);
        expect(h.byteLength).toBe(44 + 160 * 2);
    });

    it('clamps out-of-range float samples to the int16 range', async () => {
        const buf = await encodeWAV(new Float32Array([2, -2, 0])).arrayBuffer();
        const view = new DataView(buf);
        expect(view.getInt16(44, true)).toBe(32767);   // +2 -> max
        expect(view.getInt16(46, true)).toBe(-32768);  // -2 -> min
        expect(view.getInt16(48, true)).toBe(0);
    });
});

describe('processRecordedAudio', () => {
    it('merges blocks and passes them through when already at 16 kHz', async () => {
        const blocks = [new Float32Array([0, 0.5]), new Float32Array([1])];
        const blob = await processRecordedAudio(blocks, 3, 16000);
        const h = await readHeader(blob);
        expect(h.sampleRate).toBe(16000);
        expect(h.dataLen).toBe(3 * 2); // 3 merged samples, no resample
    });
});
