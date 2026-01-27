import React, { useState, useEffect } from 'react';
import { aiService } from '../services/aiService';

export const Flashcard = ({ word, mode, onAudioPlay, knownWords = [], attempted = false, audioVolume = 0, isRecording = false }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [sentence, setSentence] = useState(null);
    const [loadingSentence, setLoadingSentence] = useState(false);

    // Reset state when word changes
    useEffect(() => {
        setIsFlipped(false);
        setSentence(null);
        setLoadingSentence(false);
    }, [word]);

    const handleFlip = async () => {
        // PERF FIX: Flip immediately so UI is responsive. Content loads in background.
        setIsFlipped(!isFlipped);

        // Always allow flip, but only generate if attempted
        if (!isFlipped && attempted && !sentence && !loadingSentence) {
            setLoadingSentence(true);
            const raw = await aiService.generateContextSentence(word.polish, knownWords);
            // Parse "Polish;English"
            const parts = raw.split(';');
            setSentence({
                polish: parts[0] ? parts[0].trim() : "Sentence generation failed.",
                english: parts[1] ? parts[1].trim() : ""
            });
            setLoadingSentence(false);
        }
    };

    const handleAudioClick = (e) => {
        e.stopPropagation();
        onAudioPlay(word);
    };

    const renderSentence = (text) => {
        if (!text) return null;
        // Replace [TARGET]...[/TARGET] with span
        const html = text
            .replace(/\[TARGET\]/g, '<span class="target-highlight">')
            .replace(/\[\/TARGET\]/g, '</span>');
        return <span dangerouslySetInnerHTML={{ __html: html }} />;
    };

    const displayText = mode === 'comprehension' ? '???' : word.english;

    // AUDIO FEEDBACK STYLE
    const glowStyle = (isRecording && audioVolume > 5) ? {
        boxShadow: `0 0 ${20 + (audioVolume * 0.8)}px rgba(56, 189, 248, ${0.4 + (audioVolume / 200)})`,
        transform: `scale(${1 + (audioVolume / 1000)})`,
        borderColor: 'var(--primary-accent)',
        transition: 'box-shadow 0.05s ease, transform 0.05s ease'
    } : {};

    return (
        <div className="flashcard-container">
            <div
                className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}
                style={{ ...glowStyle }}
                onClick={handleFlip}
            >
                {/* Front */}
                <div className="flashcard-front" title="Click to flip">
                    <div className="flip-cue" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.5 }}>
                        <span style={{ fontSize: '1.2rem' }}>🔁</span>
                    </div>

                    <div className="card-content">
                        <h2 style={{ marginBottom: '0.5rem' }}>{displayText}</h2>
                        {mode === 'input' && <p className="hint" style={{ margin: 0 }}>(say in polish)</p>}
                        {mode === 'recall' && <p className="hint" style={{ margin: 0 }}>(say in polish)</p>}
                        {mode === 'comprehension' && <p className="hint" style={{ margin: 0 }}>(define in english)</p>}
                    </div>
                    {(mode === 'input' || mode === 'comprehension') && (
                        <button className="progress-btn" style={{ marginTop: '1.5rem' }} onClick={handleAudioClick}>
                            Play Audio 🔊
                        </button>
                    )}
                </div>

                {/* Back */}
                <div className="flashcard-back">
                    <div className="card-content" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        {!attempted ? (
                            <div style={{ opacity: 0.7, fontStyle: 'italic', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, marginBottom: '2rem' }}>
                                <p style={{ fontSize: '2rem', marginBottom: '0.25rem', marginTop: 0 }}>🔒</p>
                                <p style={{ margin: 0 }}>Attempt the word first<br />to reveal the context sentence.</p>
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginBottom: '2rem' }}>
                                {loadingSentence ? (
                                    <p className="generated-sentence" style={{ opacity: 0.5 }}>generating example...</p>
                                ) : (
                                    <>
                                        <p className="generated-sentence" style={{ marginBottom: '0.5rem' }}>
                                            {renderSentence(sentence?.polish)}
                                        </p>
                                        {sentence?.english && (
                                            <p style={{
                                                fontSize: '1rem',
                                                color: 'var(--text-secondary)',
                                                fontStyle: 'italic',
                                                marginTop: 0,
                                                fontWeight: 400
                                            }}>
                                                {sentence.english}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        <div className="word-miniature" style={{ color: '#fff', fontWeight: 800, opacity: 1 }}>
                            {displayText}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
