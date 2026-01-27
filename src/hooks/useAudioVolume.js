import { useState, useEffect, useRef } from 'react';

export const useAudioVolume = (stream, isRecording) => {
    const [volume, setVolume] = useState(0);
    const requestRef = useRef();
    const audioContextRef = useRef();
    const analyserRef = useRef();
    const sourceRef = useRef();

    useEffect(() => {
        if (isRecording && stream) {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const audioCtx = audioContextRef.current;

            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            if (!analyserRef.current) {
                analyserRef.current = audioCtx.createAnalyser();
                analyserRef.current.fftSize = 64; // Smaller for just volume
                analyserRef.current.smoothingTimeConstant = 0.8;
            }

            if (!sourceRef.current || sourceRef.current.mediaStream !== stream) {
                sourceRef.current = audioCtx.createMediaStreamSource(stream);
                sourceRef.current.connect(analyserRef.current);
            }

            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateVolume = () => {
                analyserRef.current.getByteFrequencyData(dataArray);

                let sum = 0;
                // Focus on lower frequencies for voice? Or just average all.
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;

                // Normalize roughly 0-1. 255 is max byte value.
                // Voice isn't usually full 255. Let's scale it to be responsive.
                const normalized = Math.min(1, average / 100);

                setVolume(normalized);
                requestRef.current = requestAnimationFrame(updateVolume);
            };

            updateVolume();

        } else {
            setVolume(0);
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
            // Optional: Suspend context to save CPU
            if (audioContextRef.current && audioContextRef.current.state === 'running') {
                audioContextRef.current.suspend();
            }
        }

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [isRecording, stream]);

    return volume;
};
