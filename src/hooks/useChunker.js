import { useState, useEffect } from 'react';
import initialWords from '../data/words.json';
import confetti from 'canvas-confetti';

const POOL_SIZE = 10;
// Intervals in ms: 
// Bucket 0: 1m (Learning Step 1 - Immediate Retry)
// Bucket 1: 10m (Learning Step 2 - Short Term)
// Bucket 2: 1d (Graduated)
// Bucket 3: 3d
// Bucket 4: 7d
// Bucket 5: 14d
const SRS_INTERVALS = [
    1 * 60 * 1000,       // Bucket 0: 1 minute
    10 * 60 * 1000,      // Bucket 1: 10 minutes
    24 * 60 * 60 * 1000,      // Bucket 2: 1 day
    3 * 24 * 60 * 60 * 1000,  // Bucket 3: 3 days
    7 * 24 * 60 * 60 * 1000,  // Bucket 4: 7 days
    14 * 24 * 60 * 60 * 1000  // Bucket 5: 14 days
];

const XP_CORRECT = 50;
const XP_INCORRECT = 5;
const XP_MASTERY = 200;

export const useChunker = () => {
    // Structure: { words: { [id]: { bucket: 0-5, nextReview: timestamp, total_correct, total_incorrect } } }
    const [gameState, setGameState] = useState(() => {
        const saved = localStorage.getItem('polishFlow_state');
        return saved ? JSON.parse(saved) : { xp: 0, level: 1, words: {} };
    });

    const [workingSet, setWorkingSet] = useState([]);

    const calculateLevel = (xp) => Math.floor(Math.sqrt(xp / 100)) + 1;

    useEffect(() => {
        localStorage.setItem('polishFlow_state', JSON.stringify(gameState));
    }, [gameState]);

    // Dynamic Batching Logic
    useEffect(() => {
        const now = Date.now();

        // 1. Identify words that ARE active (have been seen)
        const activeIds = Object.keys(gameState.words);

        // 2. Find explicit "Due" words
        const dueWords = activeIds.filter(id => {
            const w = gameState.words[id];
            return w.nextReview <= now && w.bucket < SRS_INTERVALS.length; // Active and due
        });

        // 3. Fill remaining slots with NEW words if needed
        let pool = [...dueWords];

        if (pool.length < POOL_SIZE) {
            // Find words not in activeIds
            const remainingCount = POOL_SIZE - pool.length;
            const newWords = initialWords
                .filter(w => !gameState.words[w.id]) // Not yet seen
                .slice(0, remainingCount)
                .map(w => w.id);
            pool = [...pool, ...newWords];
        }

        // 4. Map IDs to full word objects
        // If pool is empty (all mastered?), maybe just show mastered ones for review? 
        // For now, prioritize active learning.
        const set = pool.map(id => initialWords.find(w => w.id == id)).filter(Boolean);

        // Only update if IDs changed to avoid loops? 
        // Actually, simple resize/reorder is fine.
        setWorkingSet(set);

    }, [gameState.words]);

    const addXP = (amount) => {
        setGameState(prev => {
            const newXP = prev.xp + amount;
            const newLevel = calculateLevel(newXP);
            if (newLevel > prev.level) {
                confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#38bdf8', '#fbbf24', '#f472b6'] });
            }
            return { ...prev, xp: newXP, level: newLevel };
        });
    };

    const recordSuccess = (wordId) => {
        setGameState(prev => {
            // Default to bucket -1 so first success moves to 0 (1 minute)
            // Actually, if it's new, we want 1st success -> Bucket 1 (10m) or Bucket 2 (1d)?
            // Standard Anki: New -> 1m (Again) or 10m (Good).
            // Let's simplified flow: New -> Bucket 1 (10m).
            // If currently Bucket 0 (Just failed), Success -> Bucket 1 (10m).
            const current = prev.words[wordId] || { bucket: 0, total_correct: 0, total_incorrect: 0 };

            let newBucket;
            // Promotion Logic
            if (current.bucket === 0) {
                // Moved from "Learning" (1m) to "Short Term" (10m)
                newBucket = 1;
            } else {
                // Standard SRS Progression
                newBucket = Math.min(current.bucket + 1, SRS_INTERVALS.length - 1);
            }

            const isMastery = newBucket === SRS_INTERVALS.length - 1;

            // FX
            if (isMastery && current.bucket < newBucket) {
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                addXP(XP_MASTERY);
            } else {
                addXP(XP_CORRECT);
            }

            return {
                ...prev,
                words: {
                    ...prev.words,
                    [wordId]: {
                        ...current,
                        bucket: newBucket,
                        nextReview: Date.now() + SRS_INTERVALS[newBucket],
                        total_correct: (current.total_correct || 0) + 1,
                        status: isMastery ? 'mastered' : 'learning'
                    }
                }
            };
        });
    };

    const recordFailure = (wordId) => {
        addXP(XP_INCORRECT);
        setGameState(prev => {
            const current = prev.words[wordId] || { bucket: 0, total_correct: 0, total_incorrect: 0 };

            // PENALTY: Reset to Bucket 0 (1 minute)
            // This forces immediate re-learning in the same session.
            const newBucket = 0;

            return {
                ...prev,
                words: {
                    ...prev.words,
                    [wordId]: {
                        ...current,
                        bucket: newBucket,
                        nextReview: Date.now() + SRS_INTERVALS[newBucket],
                        total_incorrect: (current.total_incorrect || 0) + 1,
                        status: 'learning'
                    }
                }
            };
        });
    };

    const markAsKnown = (wordId) => {
        const alreadyMastered = gameState.words[wordId]?.status === 'mastered';
        if (!alreadyMastered) {
            addXP(XP_MASTERY);
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
        setGameState(prev => ({
            ...prev,
            words: {
                ...prev.words,
                [wordId]: {
                    ...(prev.words[wordId] || {}),
                    bucket: SRS_INTERVALS.length - 1, // Max bucket
                    nextReview: Date.now() + SRS_INTERVALS[SRS_INTERVALS.length - 1],
                    status: 'mastered'
                }
            }
        }));
    };

    const suspendWord = (wordId) => {
        setGameState(prev => ({
            ...prev,
            words: {
                ...prev.words,
                [wordId]: {
                    ...(prev.words[wordId] || {}),
                    bucket: SRS_INTERVALS.length, // Special "Suspended" bucket (Infinity?) or just status='suspended'
                    // Actually, let's just mark it as 'suspended' and ensure the chunker ignores it.
                    // The easiest way is to push it to a high bucket or a specific status.
                    // Let's use status field.
                    status: 'suspended',
                    nextReview: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year
                }
            }
        }));
    };

    const resetProgress = () => {
        if (confirm("Reset ALL progress?")) {
            const newState = { xp: 0, level: 1, words: {} };
            setGameState(newState);
            localStorage.setItem('polishFlow_state', JSON.stringify(newState));
            window.location.reload();
        }
    };

    // Calculate due count for UI
    const dueCount = workingSet.filter(w => {
        const prog = gameState.words[w.id];
        return prog && prog.nextReview <= Date.now() && prog.status !== 'suspended';
    }).length;

    return {
        workingSet,
        gameState,
        dueCount,
        recordSuccess,
        recordFailure,
        markAsKnown,
        suspendWord,
        resetProgress
    };
};
