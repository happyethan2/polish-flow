import { useCallback, useEffect, useRef, useState } from 'react';
import { classifyError, reviseWiki, ERROR_LABELS } from '../services/wikiService';

const ATTEMPTS_KEY = 'polishFlow_attempts';
const WIKI_KEY = 'polishFlow_wiki';
const MAX_ATTEMPTS = 100;      // ring buffer cap
const REVISE_EVERY = 3;        // revise the wiki every Nth failed attempt
const REVISE_WINDOW = 20;      // attempts fed into a revision
const MAX_VERSIONS = 20;       // wiki history cap
const EXCERPT_CHARS = 700;

const load = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};

const emptyWiki = { current: '', versions: [], failuresSinceRevision: 0 };

/**
 * Pull the actionable slice of the profile for injection into coaching / sentence prompts.
 * The profile lists Strengths first, so a naive head-slice buries the Weaknesses and Focus —
 * exactly the parts a prompt needs. Prefer everything from "## Weaknesses" onward; fall back
 * to the whole thing. Capped so a prompt is never flooded.
 */
const actionableExcerpt = (md) => {
    if (!md) return undefined;
    const i = md.indexOf('## Weaknesses');
    const slice = i >= 0 ? md.slice(i) : md;
    return slice.slice(0, EXCERPT_CHARS);
};

/**
 * Longitudinal summary computed for free from the full attempt log. Gives the revision model
 * reliable aggregate trends (error histogram, most-missed words, success rate) that the short
 * recent-window table alone can't show.
 */
const buildStats = (attempts) => {
    const total = attempts.length;
    if (!total) return '';
    const wrong = attempts.filter((a) => !a.correct);
    const correct = total - wrong.length;

    const hist = {};
    for (const a of wrong) {
        if (a.errorType && a.errorType !== 'pending') hist[a.errorType] = (hist[a.errorType] || 0) + 1;
    }
    const histLine = Object.entries(hist)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${ERROR_LABELS[k] || k} ×${n}`)
        .join(', ') || 'none tagged yet';

    const wordFails = {};
    for (const a of wrong) wordFails[a.polish] = (wordFails[a.polish] || 0) + 1;
    const topWords = Object.entries(wordFails)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([w, n]) => `${w} ×${n}`)
        .join(', ') || 'none';

    const pct = Math.round((correct / total) * 100);
    return `Overall: ${correct}/${total} correct (${pct}%).\nError types: ${histLine}.\nMost-missed words: ${topWords}.`;
};

/**
 * The self-revising learner profile (LLM-Wiki). Runs entirely off the critical path:
 * classification and revision are fire-and-forget, and any AI/JSON failure is swallowed so
 * the learning loop and SRS progress are never blocked or corrupted.
 */
export const useLearnerProfile = () => {
    const [attempts, setAttempts] = useState(() => load(ATTEMPTS_KEY, []));
    const [wiki, setWiki] = useState(() => ({ ...emptyWiki, ...load(WIKI_KEY, emptyWiki) }));

    // Live refs so fire-and-forget async work reads current values without stale closures.
    const attemptsRef = useRef(attempts);
    attemptsRef.current = attempts;
    const failuresRef = useRef(wiki.failuresSinceRevision || 0);
    const revisingRef = useRef(false);

    useEffect(() => {
        try { localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts)); } catch { /* quota */ }
    }, [attempts]);

    useEffect(() => {
        try { localStorage.setItem(WIKI_KEY, JSON.stringify(wiki)); } catch { /* quota */ }
    }, [wiki]);

    const appendAttempt = useCallback((attempt) => {
        setAttempts((prev) => [...prev, attempt].slice(-MAX_ATTEMPTS));
    }, []);

    const patchAttempt = useCallback((id, patch) => {
        setAttempts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    }, []);

    const triggerRevision = useCallback(async () => {
        if (revisingRef.current) return;
        revisingRef.current = true;
        try {
            const text = await reviseWiki({
                currentWiki: wiki.current,
                recentAttempts: attemptsRef.current.slice(-REVISE_WINDOW),
                stats: buildStats(attemptsRef.current),
            });
            if (text) {
                setWiki((prev) => ({
                    ...prev,
                    current: text,
                    versions: [...prev.versions, { ts: Date.now(), text }].slice(-MAX_VERSIONS),
                }));
            }
        } finally {
            revisingRef.current = false;
        }
        // wiki.current is captured at call time; acceptable — revisions are incremental.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wiki.current]);

    /**
     * Record one graded attempt. Correct answers are logged lightly; incorrect ones are
     * classified asynchronously and may trigger a wiki revision. Fire-and-forget.
     */
    const recordAttempt = useCallback(({ wordId, polish, phonetic, heard, correct, confidence }) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        appendAttempt({ id, ts: Date.now(), wordId, polish, heard, correct, errorType: correct ? null : 'pending', note: '' });

        if (correct) return;

        (async () => {
            try {
                const result = await classifyError({ targetWord: polish, phonetic, heard, confidence });
                patchAttempt(id, { errorType: result?.errorType || 'other', note: result?.note || '' });
            } catch {
                patchAttempt(id, { errorType: 'other' });
            }

            failuresRef.current += 1;
            const shouldRevise = failuresRef.current >= REVISE_EVERY;
            if (shouldRevise) failuresRef.current = 0;
            setWiki((prev) => ({ ...prev, failuresSinceRevision: failuresRef.current }));
            if (shouldRevise) triggerRevision();
        })();
    }, [appendAttempt, patchAttempt, triggerRevision]);

    const reset = useCallback(() => {
        failuresRef.current = 0;
        setAttempts([]);
        setWiki({ ...emptyWiki });
        // Clear storage synchronously so a full progress reset (which reloads) doesn't leave it behind.
        try {
            localStorage.removeItem(ATTEMPTS_KEY);
            localStorage.removeItem(WIKI_KEY);
        } catch { /* ignore */ }
    }, []);

    // Actionable excerpt injected into coaching / sentence prompts (undefined when empty).
    const profileExcerpt = actionableExcerpt(wiki.current);

    // "Focus next": most common error type among recent failed attempts.
    const focusNext = (() => {
        const counts = {};
        for (const a of attempts) {
            if (!a.correct && a.errorType && a.errorType !== 'pending') {
                counts[a.errorType] = (counts[a.errorType] || 0) + 1;
            }
        }
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return top ? (ERROR_LABELS[top[0]] || top[0]) : null;
    })();

    return { wiki, attempts, profileExcerpt, focusNext, recordAttempt, reset };
};
