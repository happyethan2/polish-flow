import { getProvider } from './aiProvider';
import { generateJsonWithRetry } from './llmJson';
import { log } from '../utils/logger';

// System prompt for the audio transcriber. It must map sounds to Polish spelling only.
const TRANSCRIBER_SYSTEM =
    'You are a dedicated Polish phonetic transcriber. You are incapable of understanding English. ' +
    'Map ALL audio input to the nearest corresponding Polish phonemes/spelling. ' +
    'If a sound is ambiguous, assume the Polish interpretation.';

// Optional block injected from the LLM-Wiki learner profile (WS5). Kept short.
const profileBlock = (excerpt) =>
    excerpt ? `\nLearner profile (recurring issues to keep in mind):\n${excerpt}\n` : '';

export const aiService = {
    // Tier 1: fast pronunciation verification.
    // opts: { provider?, profileExcerpt? }
    // Throws on provider/network failure — an API error must never be graded as "incorrect"
    // (it would poison the SRS and learner profile with false failures).
    validatePronunciation: async (audioBlob, targetPolishWord, opts = {}) => {
        if (!navigator.onLine) {
            throw new Error('You appear to be offline.');
        }
        const prompt = `
      Target Word: "${targetPolishWord}"

      Task: Transcribe the audio using strict Polish phonology and verify against the Target.

      Output Format: HEARD_PHRASE;STATUS;CONFIDENCE

      Rules:
      1. HEARD_PHRASE: Transcribe what you hear using Polish spelling (e.g., If you hear the sound 'bitch', write 'być'.).
      2. STATUS:
        - "CORRECT" only if the HEARD_PHRASE matches the Target Word (allowing for minor accent deviations).
        - "INCORRECT" for any mismatch.
      3. CONFIDENCE: 0.0-1.0 score.

      Example Output:
      Dziękuję;CORRECT;0.9
      `;

        const t0 = performance.now();
        log('api', 'validate:request', { target: targetPolishWord, blobBytes: audioBlob?.size, blobType: audioBlob?.type });
        const text = await getProvider(opts.provider).generateFromAudio({
            system: TRANSCRIBER_SYSTEM,
            prompt,
            audioBlob,
            maxTokens: 400,
            temperature: 0.6,
        });

        const parts = text.split(';');
        const heard = parts[0]?.trim() || '---';
        const status = parts[1]?.trim().toUpperCase() || 'INCORRECT';
        const confidence = parseFloat(parts[2]) || 0;

        log('api', 'validate:response', {
            ms: Math.round(performance.now() - t0),
            raw: text,
            heard,
            status,
            confidence,
            partsCount: parts.length,
        });

        return { correct: status === 'CORRECT', heard, confidence };
    },

    // Tier 3: lazy coaching on an incorrect answer.
    // opts: { provider?, profileExcerpt?, phonetic? }
    getCoachAdvice: async (targetWord, heardWord, opts = {}) => {
        try {
            const phoneticLine = opts.phonetic ? `\nTarget pronunciation guide: "${opts.phonetic}"` : '';
            const prompt = `You are a helpful Polish tutor.
Target word: "${targetWord}"${phoneticLine}
User said: "${heardWord}"
${profileBlock(opts.profileExcerpt)}
Task:
1. Explain the key difference in meaning or pronunciation, and give one concrete articulation tip
   (e.g. how to shape the mouth/tongue for the sound they missed).
2. If the user said an English word, point it out.
3. If it connects to a recurring issue above, mention it briefly.
4. Keep it to at most 2 short sentences.
5. Respond in English only.

Analysis:`;

            const advice = await getProvider(opts.provider).generateText({
                prompt,
                maxTokens: 800,
                temperature: 0.7,
            });
            return advice || 'Practice makes perfect!';
        } catch (e) {
            console.error('[getCoachAdvice] Error:', e);
            return 'Practice makes perfect!';
        }
    },

    // On-demand deep-dive after a miss: the target word and the word the user actually said,
    // each in a simple example sentence with a translation, plus a one-line tip on how the two
    // sounds differ, so the learner can compare them.
    // opts: { provider?, profileExcerpt?, phonetic? }
    // Returns { target: {word, polish, english}, heard: {word, polish, english}, tip? } or null.
    generateComparisonSentences: async (targetWord, heardWord, opts = {}) => {
        const phoneticLine = opts.phonetic ? ` Its pronunciation is roughly "${opts.phonetic}".` : '';
        const prompt = `A Polish learner was asked to say "${targetWord}"${phoneticLine} but said "${heardWord}" instead.
Create one simple beginner-level (A1) example sentence for EACH word so the learner can compare them side by side,
and one short tip on how the two sounds differ and how to fix it.${profileBlock(opts.profileExcerpt)}
Return JSON only, exactly this shape:
{"target": {"word": "${targetWord}", "polish": "<sentence using ${targetWord}>", "english": "<translation>"},
 "heard": {"word": "${heardWord}", "polish": "<sentence using ${heardWord}>", "english": "<translation>"},
 "tip": "<one short sentence contrasting the two sounds and how to fix the mistake>"}
Rules:
1. Each Polish sentence must be 4-8 words and grammatically natural.
2. If "${heardWord}" is not a real Polish word, use the closest real Polish word and keep the "word" field as that real word.
3. Translations must be plain English. The tip must be plain English, one sentence.`;

        const isEntry = (e) =>
            e && typeof e.word === 'string' && typeof e.polish === 'string' && typeof e.english === 'string';

        return generateJsonWithRetry(
            getProvider(opts.provider),
            { system: 'You are a Polish tutor. Respond with JSON only.', prompt, tier: 'fast', maxTokens: 500 },
            (o) => o && isEntry(o.target) && isEntry(o.heard)
        );
    },

    // Context sentence for the flip card.
    // opts: { provider?, profileExcerpt? }
    // Returns { polish, english } — the Polish sentence wraps the target word in [TARGET]…[/TARGET].
    // Always resolves (never throws); falls back to a trivial sentence if generation fails.
    generateContextSentence: async (targetWordPolish, knownVocabulary = [], opts = {}) => {
        const fallback = {
            polish: `To jest bardzo ciekawe słowo: [TARGET]${targetWordPolish}[/TARGET].`,
            english: `This is a very interesting word: ${targetWordPolish}.`,
        };

        let usableVocab = [...knownVocabulary];
        if (usableVocab.length < 50) {
            usableVocab.push('jest', 'to', 'mam', 'lubię', 'chcę', 'pić', 'jeść', 'dom', 'kot', 'pies');
        }
        const vocabString = usableVocab.slice(0, 200).join(', ');

        const prompt = `Generate a complete Polish sentence using the word: "${targetWordPolish}", then its English translation.
Constraints:
1. Use words from this vocabulary list if possible: [${vocabString}].
2. Polish sentence must be at least 5 words long.
3. Include a verb and an adjective.
4. WRAP the target word (and its declensions) in [TARGET]...[/TARGET] tags in the POLISH sentence only.
5. Keep it simple enough for a beginner (A1/A2) but not trivial.${
            opts.profileExcerpt ? `\n6. Prefer vocabulary that exercises the learner's weak sounds noted here: ${opts.profileExcerpt}` : ''
        }
Return JSON only, exactly: {"polish": "To jest [TARGET]dom[/TARGET].", "english": "This is a house."}`;

        const result = await generateJsonWithRetry(
            getProvider(opts.provider),
            { system: 'You are a Polish tutor. Respond with JSON only.', prompt, tier: 'fast', maxTokens: 600 },
            (o) => o && typeof o.polish === 'string' && o.polish.length > 0 && typeof o.english === 'string'
        );
        return result || fallback;
    },
};
