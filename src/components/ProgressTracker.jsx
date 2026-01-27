import React from 'react';
import allWords from '../data/words.json';

export const ProgressTracker = ({ userProgress, onClose }) => {
    // Filter for mastered words
    const masteredWords = allWords.filter(word => {
        const prog = userProgress[word.id];
        return prog && prog.status === 'mastered';
    });

    return (
        <div className="progress-tracker-overlay">
            <div className="progress-tracker-modal">
                <div className="progress-header">
                    <h2>Your Progress</h2>
                    <button className="close-button" onClick={onClose}>X</button>
                </div>

                <div className="mastered-count">
                    Mastered: {masteredWords.length} / {allWords.length}
                </div>

                <div className="words-list">
                    {masteredWords.length === 0 ? (
                        <p className="no-data">No words mastered yet. Keep practicing!</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Polish</th>
                                    <th>English</th>
                                </tr>
                            </thead>
                            <tbody>
                                {masteredWords.map(word => (
                                    <tr key={word.id}>
                                        <td>{word.polish}</td>
                                        <td>{word.english}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
