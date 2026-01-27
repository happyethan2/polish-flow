# Polish Flow 🇵🇱
> **Status: 🚧 Currently in Development**

> *This README, and project was written and coded by AI under human supervision.*

**Polish Flow** is an advanced, AI-powered language learning application designed to accelerate Polish fluency through personalized Spaced Repetition (SRS) and real-time pronunciation coaching. Unlike static flashcard apps, Polish Flow listens to you, corrects your mistakes, and dynamically generates context to help you learn.

## 🚀 Key Features

- **AI Pronunciation Analysis**: Uses Google's **Gemini 1.5 Pro / 3 Flash** models to listen to your speech and allow for nuance (it knows if you said the wrong word or just pronounced it poorly).
- **Smart Coaching**: If you get a word wrong, the **AI Coach** explains *why* (e.g., "You used the singular form instead of plural").
- **Dynamic Context**: Click a card to flip it, and the AI instantly generates a **unique Polish sentence** using the word, complete with an English translation.
- **Audio Visualization**: The interface responds to your voice input with a reactive glow, giving you confidence that the system is listening.
- **SRS optimization**: A custom Spaced Repetition System optimizes review intervals (1m, 10m, 1d, 3d, 7d, 14d) to maximize retention.

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
- **Flashcard Logic**: The UI is built around a "Flip Card" interaction.
    - **Front**: The English word (Recall Mode) or Polish word (Input Mode).
    - **Back**: Contextual sentence generated on-the-fly by AI to prove understanding.
- **Audio Handling**: Real-time `MediaRecorder` captures user input, visualized via `AudioContext` analysis (reactive glow).

### 2. The Brain (`aiService.js`)
The app connects directly to the **Google Gemini API** (via `generativelanguage.googleapis.com`) for low-latency intelligence:
- **Audio Model**: Parses raw audio blobs to transcribe and verify pronunciation against the target word.
- **Sentence Model**: `Gemini-2.5-Flash` (Uncapped) generates bilingual example sentences.
- **Coach Model**: `Gemini-2.5-Flash` provides concise, 1-sentence feedback on errors.

### 3. Spaced Repetition System (The "Chunker")
The state is managed locally in the browser (`localStorage`).
- **Buckets**: Words move through buckets (0-5) based on success/failure.
- **Session Management**: Failing a word drops it to **Bucket 0** (1 minute review), forcing immediate re-learning.
- **XP & Levels**: Gamified progress tracking to keep motivation high.

---

## 🛠️ Running Locally

1.  **Clone the repo**.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Set API Key**: Create a `.env` file and add your Google Gemini Key:
    ```
    VITE_GOOGLE_API_KEY=your_key_here
    ```
4.  **Start Development Server**:
    ```bash
    npm run dev
    ```
