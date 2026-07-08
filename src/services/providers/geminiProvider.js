import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODELS } from '../aiConfig';
import { blobToBase64 } from '../../utils/blob';

let client = null;
function getClient() {
    if (!client) {
        const key = import.meta.env.VITE_GOOGLE_API_KEY;
        if (!key) throw new Error('VITE_GOOGLE_API_KEY is not set.');
        client = new GoogleGenerativeAI(key);
    }
    return client;
}

// Retry wrapper for transient 503 (overloaded) responses.
async function generateWithRetry(model, parts, retries = 3, initialDelay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await model.generateContent(parts);
        } catch (error) {
            const transient = error?.message?.includes('503') || error?.status === 503;
            if (transient && i < retries - 1) {
                await new Promise((r) => setTimeout(r, initialDelay * Math.pow(2, i)));
            } else {
                throw error;
            }
        }
    }
}

export const geminiProvider = {
    name: 'gemini',

    async generateFromAudio({ system, prompt, audioBlob, maxTokens = 400, temperature = 0.6 }) {
        const model = getClient().getGenerativeModel({
            model: MODELS.gemini.audio,
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
            // Note: deliberately NOT enabling includeThoughts — thought tokens leak into
            // response.text() and corrupt the "HEARD;STATUS;CONF" parse.
            generationConfig: { maxOutputTokens: maxTokens, temperature, topP: 1, topK: 1 },
        });
        const audioPart = {
            inlineData: { data: await blobToBase64(audioBlob), mimeType: audioBlob.type || 'audio/wav' },
        };
        const result = await generateWithRetry(model, [prompt, audioPart]);
        return (await result.response).text().trim();
    },

    // thinking: 'minimal' (default) caps reasoning for latency-bound or high-volume calls —
    // thought tokens count against maxOutputTokens, and left on with a small budget they starve
    // the actual answer (verified: 956/1000 tokens spent thinking → truncated output).
    // 'default' leaves the model's native dynamic thinking on; callers must pair it with a
    // large maxTokens. Only use it for background jobs where quality beats latency.
    async generateText({ system, prompt, maxTokens = 600, temperature = 0.7, json = false, tier = 'fast', thinking = 'minimal' }) {
        const model = getClient().getGenerativeModel({
            model: MODELS.gemini[tier] || MODELS.gemini.fast,
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature,
                ...(thinking === 'minimal' ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
                ...(json ? { responseMimeType: 'application/json' } : {}),
            },
        });
        const result = await generateWithRetry(model, [prompt]);
        return (await result.response).text().trim();
    },
};
