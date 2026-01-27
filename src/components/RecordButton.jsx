import React, { useState } from 'react';

export const RecordButton = ({ onRecord, isRecording }) => {
    return (
        <button
            className={`record-button ${isRecording ? 'recording' : ''}`}
            onMouseDown={onRecord} // Or click to toggle? Prompt says "Press 'Record' and speak".
            // Simple toggle for now.
            onClick={onRecord}
        >
            {isRecording ? 'Stop Recording ⏹️' : 'Record 🎙️'}
        </button>
    );
};
