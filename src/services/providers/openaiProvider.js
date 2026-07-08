import { MODELS } from '../aiConfig';
import { blobToBase64 } from '../../utils/blob';

// OpenAI is opt-in (for benchmarking against Gemini). It requires VITE_OPENAI_API_KEY and,
// running client-side, uses dangerouslyAllowBrowser. The SDK is dynamically imported so it
// only ships in the bundle when actually used.
let clientPromise = null;
function getClient() {
    if (!clientPromise) {
        const key = import.meta.env.VITE_OPENAI_API_KEY;
        if (!key) throw new Error('VITE_OPENAI_API_KEY is not set (OpenAI provider is opt-in).');
        clientPromise = import('openai').then(({ default: OpenAI }) =>
            new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true })
        );
    }
    return clientPromise;
}

export const openaiProvider = {
    name: 'openai',

    async generateFromAudio({ system, prompt, audioBlob, maxTokens = 400, temperature = 0.6 }) {
        const client = await getClient();
        const data = await blobToBase64(audioBlob);
        const resp = await client.chat.completions.create({
            model: MODELS.openai.audio,
            modalities: ['text'],
            max_completion_tokens: maxTokens,
            temperature,
            messages: [
                ...(system ? [{ role: 'system', content: system }] : []),
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'input_audio', input_audio: { data, format: 'wav' } },
                    ],
                },
            ],
        });
        return resp.choices[0]?.message?.content?.trim() || '';
    },

    // `thinking` is accepted for interface parity with the Gemini provider but ignored:
    // the pinned OpenAI text models have no reasoning knob.
    async generateText({ system, prompt, maxTokens = 600, temperature = 0.7, json = false, tier = 'fast' }) {
        const client = await getClient();
        const resp = await client.chat.completions.create({
            model: MODELS.openai[tier] || MODELS.openai.fast,
            max_completion_tokens: maxTokens,
            temperature,
            ...(json ? { response_format: { type: 'json_object' } } : {}),
            messages: [
                ...(system ? [{ role: 'system', content: system }] : []),
                { role: 'user', content: prompt },
            ],
        });
        return resp.choices[0]?.message?.content?.trim() || '';
    },
};
