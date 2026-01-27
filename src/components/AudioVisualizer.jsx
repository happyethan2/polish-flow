import React, { useEffect, useRef } from 'react';

export const AudioVisualizer = ({ isRecording, stream }) => {
    const canvasRef = useRef(null);
    const requestRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);

    useEffect(() => {
        if (isRecording && stream) {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const audioCtx = audioContextRef.current;

            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            analyserRef.current = audioCtx.createAnalyser();
            analyserRef.current.fftSize = 256;

            sourceRef.current = audioCtx.createMediaStreamSource(stream);
            sourceRef.current.connect(analyserRef.current);

            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const draw = () => {
                if (!canvasRef.current) return;
                const canvas = canvasRef.current;
                const canvasCtx = canvas.getContext('2d');
                if (!canvasCtx) return;

                const width = canvas.width;
                const height = canvas.height;

                requestRef.current = requestAnimationFrame(draw);
                analyserRef.current.getByteFrequencyData(dataArray);

                canvasCtx.clearRect(0, 0, width, height);

                // Calculate volume (average of frequency data)
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;

                // Draw a pulsing circle or bar
                const radius = (average / 255) * (height / 2);

                canvasCtx.beginPath();
                canvasCtx.arc(width / 2, height / 2, radius + 10, 0, 2 * Math.PI);
                canvasCtx.fillStyle = `rgba(56, 189, 248, ${0.2 + (average / 255) * 0.8})`;
                canvasCtx.fill();

                canvasCtx.beginPath();
                canvasCtx.arc(width / 2, height / 2, radius * 0.5 + 5, 0, 2 * Math.PI);
                canvasCtx.fillStyle = '#38bdf8';
                canvasCtx.fill();
            };

            draw();
        } else {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
            // Cleanup audio context if needed, or keep it alive
        }

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [isRecording, stream]);

    if (!isRecording) return null;

    return (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1 }}>
            <canvas ref={canvasRef} width="200" height="200" />
        </div>
    );
};
