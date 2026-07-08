# Polish Flow — Design & Vision

> Living design reference. Updated during the mid-2026 review/refactor that primed the app for testing.

## 1. Vision

Polish Flow rote-teaches beginner Polish vocabulary and **pronunciation** through a gamified,
spaced-repetition loop. Unlike static flashcards, it listens to the learner speak, grades the
attempt with an LLM, coaches mistakes, and — via the **LLM-Wiki learner profile** — adapts its
feedback to the individual over time. It is local-first (no accounts; all state in `localStorage`).

## 2. Requirements

**Functional**
- Present words on flip cards; play native audio; accept spoken answers via microphone.
- Grade pronunciation with an LLM (transcribe → verify against the target Polish word).
- On error, give one-sentence coaching; on flip, generate a contextual example sentence.
- Schedule reviews with a spaced-repetition system; track XP / levels for motivation.
- Maintain a self-revising learner profile that personalizes coaching and example sentences.
- Provide a stats view (SRS buckets, per-word history) and a "Coach's Notes" profile view.

**Non-functional**
- Fast: pronunciation grading is the critical path; coaching/profile work runs off it (async).
- Resilient: **an AI or JSON failure must never block input or corrupt SRS/profile state.**
- Swappable AI provider (Gemini / OpenAI) so model choice is an empirical decision, not a lock-in.
- Testable: real audio pipeline exercisable against a recorded dataset; core logic unit-tested.

## 3. Functional flow

**Modes (per word):** `input` → listen to native audio and rehearse (press Next); `recall` →
auto-record, speak, get graded. The two-mode cycle repeats across the working set.

**Grading tiers (fast → slow):**
1. **Verify** (`aiService.validatePronunciation`, audio model) → `{ correct, heard, confidence }`.
2. **Feedback** — rendered immediately from a plain data object (`components/Feedback.jsx`).
3. **Coach** (`aiService.getCoachAdvice`, fast text model) — lazy, patched into feedback when ready.
4. **Context sentence** (`aiService.generateContextSentence`) — on card flip, after an attempt.

**SRS lifecycle** (`hooks/useChunker.js`): 6 Leitner buckets with fixed intervals
(1m · 10m · 1d · 3d · 7d · 14d). New/failed → bucket 0/1; success advances one bucket to mastery (5);
any failure resets to bucket 0 for immediate re-learning. Suspension is a `status`, not a bucket.
XP: +50 correct, +5 incorrect, +200 on mastery; `level = floor(sqrt(xp/100)) + 1`.

**LLM-Wiki learner profile** (`hooks/useLearnerProfile.js`, `services/wikiService.js`):
1. *Capture* — each graded attempt is logged; failures are classified async (cheap model) into a
   Polish error type (`nasal_vowel`, `sibilant`, `soft_consonant`, `stress`, `said_english`,
   `wrong_meaning`, `mechanical`, `other`) + a short note.
2. *Revise* — every 5th failure, a stronger model incrementally rewrites a Markdown profile
   (versioned, <200 words). Fire-and-forget; failure keeps the previous profile.
3. *Feed back* — a profile excerpt biases coaching and example-sentence generation. **The SRS still
   selects which word to drill** — the wiki only supplies flavour. (Tuning ≠ selection.)
4. *Surface* — the "Coach's Notes" tab in the Lexicon shows the profile + a "Focus next" hint.

## 4. System design

```
main.jsx ──> App.jsx ──┬─ useChunker        (SRS state, XP, localStorage)
                       ├─ useRecorder       (1 AudioContext: mic capture + volume)
                       │     └─ AudioWorklet (public/pcm-recorder-worklet.js) → raw PCM
                       │     └─ utils/wavEncoder (OfflineAudioContext resample → 16 kHz mono WAV)
                       ├─ useLearnerProfile  (attempt log + wiki; localStorage)
                       │     └─ services/wikiService (classify / revise, JSON+retry)
                       ├─ aiService ── aiProvider ──┬─ geminiProvider
                       │     (prompts + parsing)    └─ openaiProvider   (dynamic import, opt-in)
                       └─ components: Flashcard, Feedback, RecordButton, XPBar, Lexicon

?dev=audio ──> dev/AudioHarness  (real pipeline vs dev_tools recordings; provider A/B)
```

**Audio pipeline:** capture raw PCM via `AudioWorklet` → merge → resample to **16 kHz mono** with
`OfflineAudioContext` (16 kHz is the native speech format for these models; higher rates add latency
without accuracy) → encode WAV → send inline (base64) to the provider.

**Persistence keys:** `polishFlow_state` (SRS/XP), `polishFlow_attempts` (ring buffer, ~100),
`polishFlow_wiki` (`{ current, versions[], failuresSinceRevision }`).

**Models** are pinned in one place (`services/aiConfig.js`), by tier: `audio` (verify, critical path),
`fast` (coach/sentence/classify — low latency, minimal thinking), `smart` (wiki revision —
`gemini-pro-latest` with **full reasoning enabled**; it's the only reasoning-enabled call because it's a
fire-and-forget background job where quality beats latency). Change models there only. Note: thinking
tokens count against `maxOutputTokens`, so reasoning-enabled calls need a large budget (the wiki uses 8k)
plus an output-structure gate to catch truncation.

## 5. Testing

- **Unit** (`npm test`, Vitest + jsdom): `useChunker` transitions, `wavEncoder` WAV correctness,
  `wikiService` JSON schema-validation + retry.
- **Live harness** (`npm run dev` → `?dev=audio`): runs the real `validatePronunciation` against the
  recorded dataset in `dev_tools/audio_testing/recordings` (correct/wrong/english) and shows a
  pass/fail grid. Provider toggle answers "is Gemini still best for our audio?" empirically.
- **Python parity** (`dev_tools/audio_testing/benchmark_audio.py`): same prompt/format, offline.

## 6. Deferred: vocabulary expansion (next phase)

The current 397-word set is a solid A1 core (all fields populated, audio present) and is intentionally
**left as-is** until the infrastructure above is proven. Target improvements for the next phase:
- Grow toward a fuller A1 set (CEFR A1 ≈ 1000 words) via `dev_tools/content_expansion`.
- Add grammar metadata: noun **gender**, verb **aspect** (perfective/imperfective), part-of-speech.
- Add a dedicated **numbers** category; verify translations/phonetics; fill audio for ids 399–402.
- Consider frequency-weighting so the highest-value words are introduced first.
