import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);

// Retry wrapper for 503 errors
const generateWithRetry = async (modelInstance, promptParts, retries = 3, initialDelay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await modelInstance.generateContent(promptParts);
    } catch (error) {
      if (error.message?.includes('503') || error.status === 503) {
        if (i === retries - 1) throw error;
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Gemini 503 error, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
};

// Audio Model: Used for main audio analysis
const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview", // Smartest model for audio analysis
  systemInstruction: {
    parts: [{ text: "You are a dedicated Polish phonetic transcriber. You are incapable of understanding English. Map ALL audio input to the nearest corresponding Polish phonemes/spelling. If a sound is ambiguous, assume the Polish interpretation." }],
  },
  generationConfig: {
    maxOutputTokens: 400,  // Low enough for low latency response times
    temperature: 0.6, // Lower temperature for precision audio analysis
    topP: 1,
    topK: 1,
    thinkingLevel: "minimal"
  }
});

// Coach Model: Used for short feedback when a response is incorrect
const coachModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash", // User requested model
  generationConfig: {
    maxOutputTokens: 800, // Long enough so output isn't truncated
    temperature: 0.7,
  }
});

// Sentence Model: Used for generating unique example sentences
const sentenceModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    maxOutputTokens: 600, // Long enough so sentence length isn't supressed
    temperature: 0.7,
  }
});

export const aiService = {
  // Tier 1: Verification (Fast)
  validatePronunciation: async (audioBlob, targetPolishWord) => {
    console.log(`[Tier 1] Validating: ${targetPolishWord}`);

    if (!navigator.onLine) {
      return { correct: false, heard: "---", feedback: "Offline" };
    }

    try {
      const reader = new FileReader();
      const base64Audio = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const audioPart = {
        inlineData: {
          data: base64Audio,
          mimeType: "audio/webm",
        },
      };

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


      const result = await generateWithRetry(model, [prompt, audioPart]);
      const response = await result.response;
      const text = response.text().trim();

      console.log(`[Tier 1] Raw: ${text}`);

      const parts = text.split(';');
      const heard = parts[0]?.trim() || "---";
      const status = parts[2]?.trim().toUpperCase() || "INCORRECT";
      const isCorrect = status === 'CORRECT';

      return {
        correct: isCorrect,
        heard: heard,
        // No feedback here to save time
      };

    } catch (error) {
      console.error("[Tier 1] Error:", error);
      return { correct: false, heard: "---", feedback: "Error" };
    }
  },

  // Tier 3: Coaching (Lazy)
  getCoachAdvice: async (targetWord, heardWord) => {
    console.log(`[Tier 3] Coaching: ${targetWord} vs ${heardWord}`);
    try {
      // Clean prompt without indentation to ensure clarity
      const prompt = `You are a helpful Polish tutor.
Target word: "${targetWord}"
User said: "${heardWord}"

Task:
1. Explain the difference in meaning or pronunciation.
2. If the user said an English word, point it out.
3. Keep it brief (1 sentence).

Analysis:`;

      console.log("[Coaching] FULL PROMPT:\n", prompt);

      const result = await coachModel.generateContent(prompt);

      // DEEP DEBUG LOGGING
      console.log("[Coaching] RAW RESULT OBJ:", JSON.stringify(result, null, 2));

      let advice = "Practice makes perfect!";
      if (result.response && result.response.text) {
        advice = result.response.text().trim();
      }

      console.log("[Coaching] FINAL TEXT:", advice);

      return advice;
    } catch (e) {
      console.error("[Tier 3] CRITICAL ERROR DETAILS:", e);
      return "Practice makes perfect!";
    }
  },

  // Sentence Generation (Context)
  generateContextSentence: async (targetWordPolish, knownVocabulary = []) => {
    // 1. Pad vocabulary if small (< 50 words)
    let usableVocab = [...knownVocabulary];
    if (usableVocab.length < 50) {
      usableVocab.push("jest", "to", "mam", "lubię", "chcę", "pić", "jeść", "dom", "kot", "pies");
    }

    // Limit vocab size sent to LLM to prevent token overflow/latency
    const vocabString = usableVocab.slice(0, 200).join(", ");

    try {
      const prompt = `Generate a complete Polish sentence using the word: "${targetWordPolish}".
        Then provide the English translation.
        IMPORTANT: Output format is strictly: "Polish Sentence;English Translation"
        Constraints:
        1. Use words from this vocabulary list if possible: [${vocabString}].
        2. Polish sentence must be at least 5 words long.
        3. Include a verb and an adjective.
        4. WRAP the target word (and its declensions) in [TARGET]...[/TARGET] tags in the POLISH sentence only. Example: "To jest [TARGET]dom[/TARGET].;This is a house."
        5. Keep it simple enough for a beginner (A1/A2) but not trivial.`;

      console.log("[Context] Generating sentence for:", targetWordPolish);

      // Use the specific uncapped model for this task
      const result = await sentenceModel.generateContent(prompt);
      const output = (await result.response).text().trim();

      console.log("[Context] Raw Result:", output);
      return output;

    } catch (e) {
      console.error("Sentence gen error:", e);
      return `To jest bardzo ciekawe słowo: [TARGET]${targetWordPolish}[/TARGET].;This is a very interesting word: ${targetWordPolish}.`; // Fallback
    }
  },

  checkDefinition: async (spokenEnglish, targetEnglishDefinition) => {
    // Kept simple for now
    try {
      const prompt = `User defined '${targetEnglishDefinition}' as '${spokenEnglish}'. Correct? Return strictly: Correct;[Optional Feedback] or Incorrect;[Feedback]`;
      const result = await generateWithRetry(model, [prompt]);
      const text = (await result.response).text();
      const parts = text.split(';');
      return {
        correct: parts[0]?.trim().toLowerCase() === 'correct',
        feedback: parts[1]?.trim() || (parts[0]?.trim().toLowerCase() === 'correct' ? "Correct!" : "Incorrect.")
      };
    } catch (error) {
      console.error("Definition check error", error);
      return { correct: false, feedback: "Error checking definition." };
    }
  }
};
