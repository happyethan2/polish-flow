# Polish Flow 🇵🇱
> **Status: 🚧 Currently in Development**

> *This README, and project was written and coded by AI under human supervision.*

**Polish Flow** is an advanced, AI-powered language learning application designed to accelerate Polish fluency through personalized Spaced Repetition (SRS) and real-time pronunciation coaching. Unlike static flashcard apps, Polish Flow listens to you, corrects your mistakes, and dynamically generates context to help you learn.

> See [docs/DESIGN.md](docs/DESIGN.md) for the full vision, requirements, and system design.

## 🚀 Key Features

- **AI Pronunciation Analysis**: Records raw microphone audio, encodes it to **16 kHz mono WAV**, and sends it to an LLM that transcribes with Polish phonology and verifies against the target word (it knows if you said the wrong word or just pronounced it poorly).
- **Swappable AI provider**: The provider layer supports **Google Gemini** (default) and **OpenAI**, pinned in one config. Model choice is an empirical decision — the built-in audio harness lets you A/B them on real recordings.
- **Self-revising learner profile (LLM-Wiki)**: Your mistakes are classified into Polish error types (nasal vowels, sibilants, soft consonants…) and periodically synthesized into a personal Markdown profile that sharpens coaching and biases example sentences toward your weak spots. See it under **Lexicon → Coach's Notes**.
- **Smart Coaching**: If you get a word wrong, the **AI Coach** explains *why* in one sentence, personalized to your recurring issues.
- **Dynamic Context**: Flip a card and the AI generates a **unique Polish sentence** using the word, with an English translation.
- **SRS**: A 6-bucket Leitner system with review intervals (1m, 10m, 1d, 3d, 7d, 14d), plus XP and levels.

---

## 📚 Syllabus & Content Expansion Pipeline

The core strength of Polish Flow is its **Flexible Syllabus**. You are not stuck with a hardcoded list of "Travel Phrases".

### Expansion Pipeline (`/content_expansion`)
We have built a Python-based pipeline to generate custom vocabulary lists tailored to your interests (e.g., *Military Defense, Paleolithic Diet, Tech Startups*).

1.  **Define Modules**: You list topics in `add_modules.py`.
2.  **Generate**: The script calls an LLM to generate relevant words, translations, and phonetic hints, updating `words.json`.
3.  **Synthesize Audio**: `generate_audio.py` uses TTS (EdgeTTS) to generate high-quality pronunciation audio for every new word.
4.  **Sync**: The pipeline automatically pushes the new data and assets into the React app (`src/data`), effectively "patching" the game with new content in seconds.

---

## 🏗️ Architecture & Workflow

### 1. Frontend (React + Vite)
- **Flashcard Logic**: A "Flip Card" interaction — front shows the English word; flip reveals an AI-generated contextual sentence.
- **Audio Capture**: A single `AudioContext` drives both an `AudioWorklet` (raw PCM capture) and volume metering (`hooks/useRecorder.js`). Raw PCM is resampled to 16 kHz mono via `OfflineAudioContext` and WAV-encoded (`utils/wavEncoder.js`).

### 2. The Brain (`services/`)
`aiService.js` composes prompts and parses results; `aiProvider.js` routes to a provider
(`providers/geminiProvider.js`, `providers/openaiProvider.js`). Model IDs are pinned per tier in
`aiConfig.js`:
- **audio** — pronunciation transcription & verification (critical path, low latency).
- **fast** — coaching, example sentences, error classification (low latency, minimal thinking).
- **smart** — LLM-Wiki learner-profile revision (`gemini-pro-latest`, full reasoning — it runs in the
  background with no latency constraint, so it's the one call where the model is allowed to think).

Gemini IDs use `-latest` aliases so they track the current GA release. Set `VITE_AI_PROVIDER=openai`
(and `VITE_OPENAI_API_KEY`) to switch providers.

### 3. Spaced Repetition System (`hooks/useChunker.js`)
Local-first (`localStorage`). Words move through 6 Leitner buckets (0–5); failing drops a word to
bucket 0 (1-minute re-learn); suspension is a `status`, not a bucket. XP & levels gamify progress.

### 4. LLM-Wiki Learner Profile (`hooks/useLearnerProfile.js`, `services/wikiService.js`)
Off the critical path: failures are classified into Polish error types and periodically synthesized
into a versioned Markdown profile that personalizes coaching and example sentences. AI/JSON failures
are always swallowed — they never block input or corrupt SRS/profile state.

---

## 🛠️ Running Locally

1.  **Install dependencies**: `npm install`
2.  **Set API key**: create a `.env` with your Gemini key (OpenAI optional):
    ```
    VITE_GOOGLE_API_KEY=your_key_here
    # optional, to benchmark/switch providers:
    # VITE_OPENAI_API_KEY=your_key_here
    # VITE_AI_PROVIDER=openai
    ```
3.  **Start**: `npm run dev`

## 🧪 Testing

- **Unit tests**: `npm test` (Vitest) — SRS transitions, WAV encoding, wiki JSON schema + retry.
- **Live audio harness**: `npm run dev`, then open **`/?dev=audio`** to run the real pronunciation
  pipeline against the recorded dataset in `dev_tools/audio_testing/` and compare providers.
- **Lint**: `npm run lint`.
