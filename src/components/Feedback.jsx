import React, { useState } from 'react';
import { Columns2, LoaderCircle, Volume2 } from 'lucide-react';
import { aiService } from '../services/aiService';
import { effectiveStatus } from '../utils/feedback';

// True when "heard" is a real transcription worth comparing against the target.
const isComparable = (heard) => heard && heard !== '---' && heard !== '(gave up)';

// Renders validation feedback from a plain data object (never JSX stored in state).
// Shape: { status, heard?, advice?, adviceLoading?, message?, swapped? }
//   status: 'processing' | 'correct' | 'incorrect' | 'revealed' | 'error'
export const Feedback = ({ feedback, word, onAudioPlay, profileExcerpt }) => {
    const [comparison, setComparison] = useState(null); // null | 'loading' | 'failed' | {target, heard, tip?}

    if (!feedback) return null;
    const { heard, advice, adviceLoading, message } = feedback;
    const status = effectiveStatus(feedback);

    if (status === 'processing') {
        return <div className="main-feedback">Processing…</div>;
    }

    if (status === 'error') {
        return <div className="main-feedback" style={{ color: 'var(--error-color)' }}>{message || 'Something went wrong.'}</div>;
    }

    const headline =
        status === 'correct' ? '✅ Correct'
        : status === 'revealed' ? '❌ Revealed'
        : '❌ Incorrect';

    const showCoach = status === 'incorrect' || status === 'revealed';

    const loadComparison = async () => {
        setComparison('loading');
        const result = await aiService.generateComparisonSentences(word.polish, heard, {
            profileExcerpt,
            phonetic: word?.phonetic,
        });
        setComparison(result || 'failed');
    };

    return (
        <div>
            <div className="main-feedback">
                {headline}
                {feedback.swapped && <span className="override-note"> (manually overridden)</span>}
            </div>
            <div className="rich-feedback">
                <p><strong>Expected:</strong> {word?.polish}</p>
                {heard && <p><strong>AI Heard:</strong> {heard.toLowerCase()}</p>}
                <p style={{ marginTop: '0.5rem', fontStyle: 'italic', opacity: 0.8, color: 'var(--primary-accent)' }}>
                    Pronunciation: "{word?.phonetic}"
                </p>
                {onAudioPlay && (
                    <button
                        className="progress-btn hear-btn"
                        onClick={() => onAudioPlay(word)}
                        aria-label="Hear the correct pronunciation"
                    >
                        <Volume2 size={16} aria-hidden="true" /> Hear pronunciation
                    </button>
                )}
                {showCoach && (adviceLoading || advice) && (
                    <div id="coach-bubble" className={`coach-bubble${adviceLoading ? ' loading' : ''}`}>
                        {adviceLoading ? 'Thinking… 🧠' : `💡 ${advice}`}
                    </div>
                )}

                {showCoach && isComparable(heard) && comparison === null && (
                    <button className="progress-btn compare-btn" onClick={loadComparison} aria-label="Compare both words in example sentences">
                        <Columns2 size={16} aria-hidden="true" /> Compare in sentences
                    </button>
                )}
                {comparison === 'loading' && (
                    <p className="compare-loading"><LoaderCircle size={14} className="spin" aria-hidden="true" /> Building comparison…</p>
                )}
                {comparison === 'failed' && (
                    <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>Couldn't build a comparison right now.</p>
                )}
                {comparison && typeof comparison === 'object' && (
                    <>
                        <div className="compare-grid">
                            <div className="compare-card compare-target">
                                <div className="compare-word">{comparison.target.word} <span className="compare-tag">target</span></div>
                                <p className="compare-polish" lang="pl">{comparison.target.polish}</p>
                                <p className="compare-english">{comparison.target.english}</p>
                            </div>
                            <div className="compare-card compare-heard">
                                <div className="compare-word">{comparison.heard.word} <span className="compare-tag">you said</span></div>
                                <p className="compare-polish" lang="pl">{comparison.heard.polish}</p>
                                <p className="compare-english">{comparison.heard.english}</p>
                            </div>
                        </div>
                        {comparison.tip && <p className="compare-tip">💡 {comparison.tip}</p>}
                    </>
                )}
            </div>
        </div>
    );
};
