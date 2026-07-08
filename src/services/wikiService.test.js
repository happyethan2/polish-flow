import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the provider layer so no network is touched.
const generateText = vi.fn();
vi.mock('./aiProvider', () => ({
    getProvider: () => ({ generateText }),
}));

import { classifyError, reviseWiki } from './wikiService';

beforeEach(() => {
    generateText.mockReset();
});

describe('classifyError (schema-validated JSON + retry)', () => {
    it('parses a valid classification', async () => {
        generateText.mockResolvedValueOnce('{"errorType":"nasal_vowel","note":"missed the ę"}');
        const out = await classifyError({ targetWord: 'będę', heard: 'bede' });
        expect(out).toEqual({ errorType: 'nasal_vowel', note: 'missed the ę' });
        expect(generateText).toHaveBeenCalledTimes(1);
    });

    it('strips code fences before parsing', async () => {
        generateText.mockResolvedValueOnce('```json\n{"errorType":"sibilant","note":"ś vs sz"}\n```');
        const out = await classifyError({ targetWord: 'środa', heard: 'szroda' });
        expect(out.errorType).toBe('sibilant');
    });

    it('retries once on bad JSON, then succeeds', async () => {
        generateText
            .mockResolvedValueOnce('not json at all')
            .mockResolvedValueOnce('{"errorType":"other","note":"unclear"}');
        const out = await classifyError({ targetWord: 'tak', heard: '???' });
        expect(out.errorType).toBe('other');
        expect(generateText).toHaveBeenCalledTimes(2);
    });

    it('rejects an unknown errorType and returns null after retry', async () => {
        generateText.mockResolvedValue('{"errorType":"banana","note":"x"}');
        const out = await classifyError({ targetWord: 'tak', heard: 'tak' });
        expect(out).toBeNull();
        expect(generateText).toHaveBeenCalledTimes(2);
    });

    it('never throws when the provider errors', async () => {
        generateText.mockRejectedValue(new Error('network down'));
        await expect(classifyError({ targetWord: 'tak', heard: 'tak' })).resolves.toBeNull();
    });

    it('runs on the smart tier and includes phonetic + confidence context', async () => {
        generateText.mockResolvedValueOnce('{"errorType":"nasal_vowel","note":"flattened ę"}');
        await classifyError({ targetWord: 'będę', phonetic: 'ben-de', heard: 'bede', confidence: 0.42 });
        const opts = generateText.mock.calls[0][0];
        expect(opts.tier).toBe('smart');
        expect(opts.prompt).toContain('ben-de');
        expect(opts.prompt).toContain('0.42');
    });
});

describe('reviseWiki', () => {
    const wellFormed = '## Strengths\n- Solid greetings.\n\n## Weaknesses\n- Nasal vowels in dziękuję.\n\n**Focus next:** practice ą/ę.';

    it('returns cleaned, well-formed markdown from the model', async () => {
        generateText.mockResolvedValueOnce('```markdown\n' + wellFormed + '\n```');
        const out = await reviseWiki({ currentWiki: '', recentAttempts: [] });
        expect(out).toContain('## Strengths');
        expect(out).toContain('Focus next');
        expect(out.startsWith('```')).toBe(false);
    });

    it('rejects a malformed revision (structural gate) so the old wiki is kept', async () => {
        generateText.mockResolvedValueOnce('wiedzieć*, *rozumieć*). Pronunciation seems fine');
        const out = await reviseWiki({ currentWiki: 'old good wiki', recentAttempts: [] });
        expect(out).toBeNull();
    });

    it('returns null (keep old wiki) when the model fails', async () => {
        generateText.mockRejectedValue(new Error('boom'));
        const out = await reviseWiki({ currentWiki: 'old', recentAttempts: [] });
        expect(out).toBeNull();
    });

    it('requests the smart tier with full reasoning and a large budget', async () => {
        generateText.mockResolvedValueOnce(wellFormed);
        await reviseWiki({ currentWiki: '', recentAttempts: [] });
        expect(generateText).toHaveBeenCalledWith(
            expect.objectContaining({ tier: 'smart', thinking: 'default', maxTokens: 8000 })
        );
    });

    it('accepts a legitimately long (but not runaway) revision', async () => {
        const filler = Array.from({ length: 320 }, (_, i) => `word${i}`).join(' ');
        const long = `## Strengths\n- ${filler}\n\n## Weaknesses\n- something.\n\n**Focus next:** practice.`;
        generateText.mockResolvedValueOnce(long);
        const out = await reviseWiki({ currentWiki: 'old good wiki', recentAttempts: [] });
        expect(out).toContain('## Strengths');
    });

    it('rejects only a pathological runaway revision (keeps the old profile)', async () => {
        const filler = Array.from({ length: 650 }, (_, i) => `word${i}`).join(' ');
        const runaway = `## Strengths\n- ${filler}\n\n## Weaknesses\n- something.\n\n**Focus next:** practice.`;
        generateText.mockResolvedValueOnce(runaway);
        const out = await reviseWiki({ currentWiki: 'old good wiki', recentAttempts: [] });
        expect(out).toBeNull();
    });

    it('feeds the longitudinal stats summary into the prompt', async () => {
        generateText.mockResolvedValueOnce(wellFormed);
        await reviseWiki({ currentWiki: '', recentAttempts: [], stats: 'Overall: 3/10 correct (30%).' });
        expect(generateText.mock.calls[0][0].prompt).toContain('Overall: 3/10 correct (30%).');
    });
});
