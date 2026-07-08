import React from 'react';

export const RecordButton = ({ onRecord, isRecording }) => {
    return (
        <button
            className={`record-button ${isRecording ? 'recording' : ''}`}
            // Only onClick — binding onMouseDown too made iOS Safari fire the toggle twice
            // per tap (synthesized mousedown + click), starting a phantom second recording.
            onClick={onRecord}
        >
            {isRecording ? 'Stop Recording ⏹️' : 'Record 🎙️'}
        </button>
    );
};
