// Central place to pin model IDs per provider. Update here when models change —
// nothing else in the app should hard-code a model name.
//
// Tiers:
//   audio - pronunciation transcription / verification (multimodal, critical path)
//   fast  - cheap, low-latency text: coaching bubble, example/comparison sentences
//   smart - background reasoning, fire-and-forget (no latency constraint — quality beats speed):
//           error classification (its label is the source of truth the profile is built on) and
//           the LLM-Wiki learner-profile revision. Both are tiny (~250 tokens) so the pro model
//           costs a fraction of a cent per call.
//
// Gemini IDs use the "-latest" aliases so they track the current GA release
// (as of mid-2026: gemini-2.5-* is deprecated; gemini-flash-latest ≈ 3.5 Flash GA).
// If the audio tier ever regresses, this one line is the place to pin an explicit version;
// the WS4 audio harness exists precisely to validate model choices empirically.
export const MODELS = {
    gemini: {
        audio: 'gemini-flash-latest',
        fast: 'gemini-flash-lite-latest',
        smart: 'gemini-pro-latest',
    },
    openai: {
        audio: 'gpt-audio-1.5', // successor to the retired gpt-4o-audio-preview line
        fast: 'gpt-4o-mini',
        smart: 'gpt-4o',
    },
};

// Default provider; override with VITE_AI_PROVIDER=openai. The dev audio harness can also
// pass a provider per call to A/B them on the same recordings.
export const DEFAULT_PROVIDER = (import.meta.env.VITE_AI_PROVIDER || 'gemini').toLowerCase();
