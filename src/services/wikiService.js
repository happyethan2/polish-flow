import { getProvider } from './aiProvider';
import { stripFences, generateJsonWithRetry } from './llmJson';

// Polish-specific pronunciation error categories the classifier must choose from.
export const ERROR_TYPES = [
    'nasal_vowel',   // ą / ę
    'sibilant',      // ś / sz / cz / ż / ź / dź confusions
    'soft_consonant',// ć / ń / ś / ź softening
    'stress',        // wrong syllable stress
    'said_english',  // said the English word instead of Polish
    'wrong_meaning', // a different Polish word
    'mechanical',    // too quiet / short / garbled
    'other',
];

export const ERROR_LABELS = {
    nasal_vowel: 'Nasal vowels (ą, ę)',
    sibilant: 'Sibilants (ś, sz, cz, ż)',
    soft_consonant: 'Soft consonants (ć, ń, ś, ź)',
    stress: 'Word stress',
    said_english: 'Reaching for English',
    wrong_meaning: 'Word confusions',
    mechanical: 'Unclear recordings',
    other: 'General practice',
};

// The prompt asks the model to aim for <300 words but explicitly allows going over rather than
// dropping relevant detail — so this is NOT a content limit. It only catches a pathological
// runaway (a model that loops or dumps garbage) so it can never overwrite a good profile. Set
// well above any legitimate profile (the structure caps at 3 bullets/section).
const MAX_PROFILE_WORDS = 600;

const wordCount = (text) => (text.trim().match(/\S+/g) || []).length;

/**
 * Classify a single failed attempt into an error type + short note.
 * Returns { errorType, note } or null on failure.
 *
 * Runs on the "smart" (reasoning) tier rather than the cheap "fast" tier: this label is the
 * source of truth the profile-revision pass later builds on, so a bad classification here
 * poisons everything downstream. The call is fire-and-forget (no latency constraint) and tiny
 * (~250 tokens), so the extra model quality costs a fraction of a cent per miss. The phonetic
 * guide and transcriber confidence give it far more to reason from than the two bare strings.
 */
export async function classifyError({ targetWord, phonetic, heard, confidence, provider } = {}) {
    const phoneticLine = phonetic ? `Its approximate pronunciation is "${phonetic}". ` : '';
    const confLine =
        typeof confidence === 'number'
            ? `The transcriber reported ${confidence.toFixed(2)} confidence (low confidence often means an unclear or garbled recording).\n`
            : '';

    const prompt = `A learner attempted the Polish word "${targetWord}". ${phoneticLine}The transcriber heard "${heard}".
${confLine}Compare what was heard against the target and classify the single main error into exactly one category:
- nasal_vowel: trouble with ą/ę nasal vowels (e.g. said "bede" for "będę")
- sibilant: confusing ś/sz/cz/ż/ź/dź sounds
- soft_consonant: softening/hardening of ć/ń/ś/ź/dź
- stress: wrong syllable stress
- said_english: they said an English word/translation instead of Polish
- wrong_meaning: a different real Polish word (semantic mixup)
- mechanical: too quiet/short/garbled, not a real attempt
- other: none of the above
Return JSON only: {"errorType": "<category>", "note": "<max 12 words on the specific mistake>"}`;

    return generateJsonWithRetry(
        getProvider(provider),
        { system: 'You are a Polish pronunciation error classifier. Respond with JSON only.', prompt, tier: 'smart', maxTokens: 700 },
        (o) => o && ERROR_TYPES.includes(o.errorType) && typeof o.note === 'string'
    );
}

/**
 * Incrementally rewrite the learner-profile Markdown from recent attempts.
 * Returns the new Markdown string, or null on failure (caller keeps the old wiki). Strong ("smart") tier.
 *
 * @param {string}  currentWiki    - the profile to revise (may be empty).
 * @param {Array}   recentAttempts - the last N graded attempts (oldest first).
 * @param {string}  stats          - a preformatted longitudinal summary (histogram, most-missed
 *                                    words, success rate) computed for free from the full log, so
 *                                    the model sees trends beyond the short recent window.
 */
export async function reviseWiki({ currentWiki, recentAttempts = [], stats = '', provider } = {}) {
    const table = recentAttempts
        .map((a) => `${a.polish} | heard: ${a.heard} | ${a.correct ? 'correct' : 'WRONG'} | auto-tag: ${a.errorType || '-'} | ${a.note || ''}`)
        .join('\n');

    const prompt = `Current learner profile (may be empty):
---
${currentWiki || '(empty)'}
---
${stats ? `Longitudinal summary (whole history):\n${stats}\n\n` : ''}Recent attempts (oldest first):
${table || '(none)'}

The "auto-tag" and note columns were assigned by a small, fast model and are frequently wrong.
Treat them only as hints — judge the real error yourself by comparing each target Polish word
with what the transcriber heard. The longitudinal summary above is reliable aggregate data.

Rewrite the learner profile. Use EXACTLY this Markdown structure, nothing before or after it:

## Strengths
- <one bullet per genuine strength, full sentence. If too little data, write "- Not enough data yet.">

## Weaknesses
- <one bullet per recurring issue, full sentence naming the sound/pattern and 1-2 example words>

**Focus next:** <one sentence naming the single highest-impact thing to practice>

Rules:
- Supersede outdated notes and prune issues that look resolved in recent attempts.
- Base every claim on the attempt evidence; never invent history.
- Complete sentences only — no trailing fragments or cut-off lists.
- At most 3 bullets per section. Aim to keep the whole profile under 300 words and write concisely.
  You MAY exceed 300 words if the learner genuinely has more issues than fit — never drop or omit
  relevant information just to hit the limit. Concision first, completeness over brevity.`;

    try {
        const text = await getProvider(provider).generateText({
            system: 'You maintain a concise Markdown learner profile for a Polish student. Edit it incrementally and honestly.',
            prompt,
            tier: 'smart',
            // Background job with no latency constraint: let the model reason fully. The large
            // budget is headroom for thinking tokens; the gates below catch truncation/runaway.
            thinking: 'default',
            maxTokens: 8000,
            temperature: 0.6,
        });
        const cleaned = stripFences(text);
        // Structural gate: a malformed revision must never replace a good profile.
        const structurallyValid =
            cleaned &&
            cleaned.includes('## Strengths') &&
            cleaned.includes('## Weaknesses') &&
            /focus next/i.test(cleaned);
        // Pathology guard: only a runaway (looping/garbage) response trips this; a legitimately
        // long profile is fine. Keep the previous profile rather than adopt the runaway.
        if (structurallyValid && wordCount(cleaned) > MAX_PROFILE_WORDS) {
            console.warn(`[reviseWiki] revision exceeded ${MAX_PROFILE_WORDS} words (runaway); keeping previous profile.`);
            return null;
        }
        return structurallyValid ? cleaned : null;
    } catch (e) {
        console.error('[reviseWiki] Error:', e);
        return null;
    }
}
