import { useCallback, useEffect, useRef, useState } from 'react';
import { processRecordedAudio } from '../utils/wavEncoder';
import { log } from '../utils/logger';

const WORKLET_URL = `${import.meta.env.BASE_URL}pcm-recorder-worklet.js`;

/**
 * Owns the microphone capture lifecycle behind a single AudioContext.
 *
 * The mic stream + audio graph are acquired ONCE and kept alive across words. Recording just
 * connects/disconnects the capture worklet — so there's no per-word getUserMedia cost and no
 * start-of-recording "dead zone" where the first ~1.3s of speech was lost (which produced
 * garbled transcriptions on mobile). The mic indicator stays on during a practice session.
 *
 * Returns: { isRecording, volume(0..1), error, start(), stop()->Blob|null, cancel() }
 */
export const useRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [volume, setVolume] = useState(0);
    const [error, setError] = useState(null);

    const ctxRef = useRef(null);
    const streamRef = useRef(null);
    const sourceRef = useRef(null);
    const workletRef = useRef(null);
    const analyserRef = useRef(null);
    const rafRef = useRef(null);
    const buffersRef = useRef([]);
    const lengthRef = useRef(0);
    const capturingRef = useRef(false); // are we collecting worklet chunks right now?
    const fedRef = useRef(false);        // is source->worklet currently connected?
    // Diagnostics
    const startTsRef = useRef(0);
    const chunkCountRef = useRef(0);
    const firstChunkTsRef = useRef(0);

    const stopMeter = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        setVolume(0);
    }, []);

    const meter = useCallback(() => {
        const loop = () => {
            const analyser = analyserRef.current;
            if (!analyser) return;
            const data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            setVolume(Math.min(1, sum / data.length / 100));
            rafRef.current = requestAnimationFrame(loop);
        };
        loop();
    }, []);

    // Fully release the mic + audio graph. Only on unmount, or to rebuild a dead graph.
    const releaseAll = useCallback(() => {
        stopMeter();
        capturingRef.current = false;
        fedRef.current = false;
        if (workletRef.current) {
            workletRef.current.port.onmessage = null;
            try { workletRef.current.disconnect(); } catch { /* not connected */ }
            workletRef.current = null;
        }
        if (analyserRef.current) {
            try { analyserRef.current.disconnect(); } catch { /* not connected */ }
            analyserRef.current = null;
        }
        if (sourceRef.current) {
            try { sourceRef.current.disconnect(); } catch { /* not connected */ }
            sourceRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
    }, [stopMeter]);

    // Ensure a live mic stream + graph exist. Acquires the mic only when missing/dead, so
    // repeat recordings reuse the hot stream (instant, no dead zone).
    const ensureGraph = useCallback(async () => {
        const streamLive = streamRef.current && streamRef.current.getTracks().some((t) => t.readyState === 'live');
        const ctxOk = ctxRef.current && ctxRef.current.state !== 'closed';
        if (streamLive && ctxOk && workletRef.current && sourceRef.current && analyserRef.current) return;

        releaseAll();
        const t0 = performance.now();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const track = stream.getAudioTracks()[0];
        log('recorder', 'getUserMedia:ok', { ms: Math.round(performance.now() - t0), settings: track?.getSettings?.(), label: track?.label });

        if (!ctxRef.current || ctxRef.current.state === 'closed') {
            ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            await ctxRef.current.audioWorklet.addModule(WORKLET_URL);
        }
        const ctx = ctxRef.current;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        const worklet = new AudioWorkletNode(ctx, 'pcm-recorder');
        worklet.port.onmessage = (e) => {
            if (!capturingRef.current) return; // ignore between recordings
            const chunk = e.data; // Float32Array
            buffersRef.current.push(chunk);
            lengthRef.current += chunk.length;
            chunkCountRef.current += 1;
            if (firstChunkTsRef.current === 0) {
                firstChunkTsRef.current = performance.now();
                log('recorder', 'firstChunk', { msAfterStart: Math.round(firstChunkTsRef.current - startTsRef.current), len: chunk.length });
            }
        };

        source.connect(analyser);
        worklet.connect(ctx.destination); // keep worklet alive; source is fed only while recording
        sourceRef.current = source;
        analyserRef.current = analyser;
        workletRef.current = worklet;
        log('recorder', 'graph:built', { sampleRate: ctx.sampleRate, state: ctx.state });
    }, [releaseAll]);

    const start = useCallback(async () => {
        setError(null);
        startTsRef.current = performance.now();
        chunkCountRef.current = 0;
        firstChunkTsRef.current = 0;
        buffersRef.current = [];
        lengthRef.current = 0;
        log('recorder', 'start:begin');
        try {
            await ensureGraph();
            const ctx = ctxRef.current;
            if (ctx.state === 'suspended') {
                await ctx.resume();
                log('recorder', 'ctx:resumed', { state: ctx.state });
            }
            capturingRef.current = true;
            if (!fedRef.current) {
                sourceRef.current.connect(workletRef.current);
                fedRef.current = true;
            }
            setIsRecording(true);
            meter();
            log('recorder', 'start:armed', { ctxState: ctx.state });
        } catch (err) {
            console.error('[useRecorder] start failed:', err);
            log('error', 'recorder.start failed', { name: err?.name, msg: String(err?.message || err) });
            setError('Could not access microphone. Please check permissions.');
            releaseAll();
            setIsRecording(false);
        }
    }, [ensureGraph, meter, releaseAll]);

    const finish = useCallback(
        async (encode) => {
            if (!isRecording) {
                log('recorder', 'finish:noop (not recording)', { encode });
                return null;
            }
            capturingRef.current = false;
            if (fedRef.current && sourceRef.current && workletRef.current) {
                try { sourceRef.current.disconnect(workletRef.current); } catch { /* already disconnected */ }
                fedRef.current = false;
            }
            stopMeter();
            setIsRecording(false);

            const buffers = buffersRef.current;
            const length = lengthRef.current;
            const sampleRate = ctxRef.current ? ctxRef.current.sampleRate : 48000;
            log('recorder', encode ? 'stop' : 'cancel', {
                chunks: chunkCountRef.current,
                samples: length,
                sampleRate,
                durationSec: +(length / sampleRate).toFixed(3),
                ctxState: ctxRef.current?.state,
                msRecording: Math.round(performance.now() - startTsRef.current),
                firstChunkMs: firstChunkTsRef.current ? Math.round(firstChunkTsRef.current - startTsRef.current) : null,
            });

            // The mic stream + context are intentionally kept alive for the next word.
            buffersRef.current = [];
            lengthRef.current = 0;

            if (!encode || length === 0) {
                if (encode) log('recorder', 'stop:EMPTY (no samples captured)');
                return null;
            }
            const blob = await processRecordedAudio(buffers, length, sampleRate);
            log('recorder', 'encoded', { bytes: blob?.size, type: blob?.type });
            return blob;
        },
        [isRecording, stopMeter]
    );

    const stop = useCallback(() => finish(true), [finish]);
    const cancel = useCallback(() => finish(false), [finish]);

    // Release the mic + context only on unmount.
    useEffect(() => {
        return () => {
            releaseAll();
            if (ctxRef.current && ctxRef.current.state !== 'closed') {
                ctxRef.current.close();
                ctxRef.current = null;
            }
        };
    }, [releaseAll]);

    return { isRecording, volume, error, start, stop, cancel };
};
