import { DEFAULT_PROVIDER } from './aiConfig';
import { geminiProvider } from './providers/geminiProvider';
import { openaiProvider } from './providers/openaiProvider';

const PROVIDERS = {
    gemini: geminiProvider,
    openai: openaiProvider,
};

export const PROVIDER_NAMES = Object.keys(PROVIDERS);

/**
 * Resolve a provider by name, falling back to the configured default.
 * Each provider exposes generateFromAudio() and generateText().
 */
export function getProvider(name) {
    const key = (name || DEFAULT_PROVIDER).toLowerCase();
    const provider = PROVIDERS[key];
    if (!provider) throw new Error(`Unknown AI provider: "${key}". Known: ${PROVIDER_NAMES.join(', ')}`);
    return provider;
}
