import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// canvas-confetti touches the DOM/canvas; stub it in tests.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { useChunker } from './useChunker';

const WORD = 1; // exists in words.json

beforeEach(() => {
    localStorage.clear();
});

describe('useChunker SRS transitions', () => {
    it('starts empty at level 1 with no XP', () => {
        const { result } = renderHook(() => useChunker());
        expect(result.current.gameState.xp).toBe(0);
        expect(result.current.gameState.level).toBe(1);
        expect(result.current.gameState.words).toEqual({});
    });

    it('promotes a new word to bucket 1 (10m step) and awards XP on success', () => {
        const { result } = renderHook(() => useChunker());
        act(() => result.current.recordSuccess(WORD));
        const w = result.current.gameState.words[WORD];
        expect(w.bucket).toBe(1);
        expect(w.total_correct).toBe(1);
        expect(w.status).toBe('learning');
        expect(result.current.gameState.xp).toBe(50);
    });

    it('resets a word to bucket 0 and tracks the miss on failure', () => {
        const { result } = renderHook(() => useChunker());
        act(() => result.current.recordSuccess(WORD)); // -> bucket 1
        act(() => result.current.recordFailure(WORD)); // -> bucket 0
        const w = result.current.gameState.words[WORD];
        expect(w.bucket).toBe(0);
        expect(w.total_incorrect).toBe(1);
        expect(result.current.gameState.xp).toBe(55); // 50 + 5
    });

    it('graduates to mastery (bucket 5) after enough successes', () => {
        const { result } = renderHook(() => useChunker());
        for (let i = 0; i < 5; i++) {
            act(() => result.current.recordSuccess(WORD));
        }
        const w = result.current.gameState.words[WORD];
        expect(w.bucket).toBe(5);
        expect(w.status).toBe('mastered');
    });

    it('suspends a word via status while keeping the bucket index in range', () => {
        const { result } = renderHook(() => useChunker());
        act(() => result.current.recordSuccess(WORD));
        act(() => result.current.suspendWord(WORD));
        const w = result.current.gameState.words[WORD];
        expect(w.status).toBe('suspended');
        expect(w.bucket).toBeLessThanOrEqual(5);
    });

    it('persists state to localStorage', () => {
        const { result } = renderHook(() => useChunker());
        act(() => result.current.recordSuccess(WORD));
        const saved = JSON.parse(localStorage.getItem('polishFlow_state'));
        expect(saved.words[WORD].bucket).toBe(1);
    });
});
