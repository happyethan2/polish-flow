import React, { useState } from 'react';
import { aiService } from '../services/aiService';

// Note: the parent mounts this with key={word.id}, so per-word state resets on word change.
export const Flashcard = ({ word, knownWords = [], attempted = false, profileExcerpt }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [sentence, setSentence] = useState(null);
    const [loadingSentence, setLoadingSentence] = useState(false);

    const handleFlip = async () => {
        // PERF FIX: Flip immediately so UI is responsive. Content loads in background.
        setIsFlipped(!isFlipped);

        // Always allow flip, but only generate if attempted
        if (!isFlipped && attempted && !sentence && !loadingSentence) {
            setLoadingSentence(true);
            const result = await aiService.generateContextSentence(word.polish, knownWords, { profileExcerpt });
            setSentence({
                polish: result?.polish?.trim() || 'Sentence generation failed.',
                english: result?.english?.trim() || '',
            });
            setLoadingSentence(false);
        }
    };

    const renderSentence = (text) => {
        if (!text) return null;
        // Escape the model's text before turning our own [TARGET] markers into highlight spans,
        // so nothing in the generated string can inject markup.
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const html = escaped
            .replace(/\[TARGET\]/g, '<span class="target-highlight">')
            .replace(/\[\/TARGET\]/g, '</span>');
        return <span dangerouslySetInnerHTML={{ __html: html }} />;
    };

    const displayText = word.english;

    return (
        <div className="flashcard-container">
            <div
                className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}
                onClick={handleFlip}
            >
                {/* Front */}
                <div className="flashcard-front" title="Click to flip for a context sentence">
                    <div className="card-content">
                        <h2 style={{ marginBottom: '0.5rem' }}>{displayText}</h2>
                        <p className="hint" style={{ margin: 0 }}>(say in polish)</p>
                    </div>
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
