import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the provider layer so no network is touched. generateJsonWithRetry (real) drives it.
const generateText = vi.fn();
vi.mock('./aiProvider', () => ({
    getProvider: () => ({ generateText }),
}));

import { aiService } from './aiService';

beforeEach(() => {
    generateText.mockReset();
});

describe('generateContextSentence (JSON contract for the flip card)', () => {
    it('returns a parsed {polish, english} object on valid JSON', async () => {
        generateText.mockResolvedValueOnce('{"polish":"To jest [TARGET]dom[/TARGET].","english":"This is a house."}');
        const out = await aiService.generateContextSentence('dom', ['jest', 'to']);
        expect(out).toEqual({ polish: 'To jest [TARGET]dom[/TARGET].', english: 'This is a house.' });
    });

    it('falls back to an object (never a raw string) when generation fails', async () => {
        generateText.mockRejectedValue(new Error('boom'));
        const out = await aiService.generateContextSentence('kot', []);
        expect(typeof out).toBe('object');
        expect(out.polish).toContain('[TARGET]kot[/TARGET]');
        expect(typeof out.english).toBe('string');
    });

    it('injects the learner profile excerpt into the prompt when provided', async () => {
        generateText.mockResolvedValueOnce('{"polish":"[TARGET]sześć[/TARGET] kotów śpi.","english":"Six cats sleep."}');
        await aiService.generateContextSentence('sześć', [], { profileExcerpt: 'Weak on sibilants ś/sz.' });
        expect(generateText.mock.calls[0][0].prompt).toContain('Weak on sibilants');
    });
});

describe('generateComparisonSentences', () => {
    const good = JSON.stringify({
        target: { word: 'proszę', polish: 'Proszę o wodę.', english: 'Please, some water.' },
        heard: { word: 'prosię', polish: 'Małe prosię biega.', english: 'A little piglet runs.' },
        tip: 'proszę ends in a soft ę; prosię has a hard e — round your lips for ę.',
    });

    it('returns the comparison including the sound tip', async () => {
        generateText.mockResolvedValueOnce(good);
        const out = await aiService.generateComparisonSentences('proszę', 'prosię');
        expect(out.target.word).toBe('proszę');
        expect(out.heard.word).toBe('prosię');
        expect(out.tip).toContain('ę');
    });

    it('threads phonetic and profile excerpt into the prompt', async () => {
        generateText.mockResolvedValueOnce(good);
        await aiService.generateComparisonSentences('proszę', 'prosię', {
            phonetic: 'PRO-sheh',
            profileExcerpt: 'Weak on soft consonants.',
        });
        const prompt = generateText.mock.calls[0][0].prompt;
        expect(prompt).toContain('PRO-sheh');
        expect(prompt).toContain('Weak on soft consonants');
    });
});
