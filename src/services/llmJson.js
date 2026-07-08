// Shared helpers for schema-validated JSON generation from LLM providers.

export function stripFences(text) {
    return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

/**
 * Generate JSON with schema validation and a single retry.
 * Never throws — returns the parsed object or null on failure.
 * @param {object} provider - provider from getProvider()
 * @param {object} opts - generateText options (prompt, system, tier, maxTokens)
 * @param {(obj: any) => boolean} validate - schema check; a falsy result triggers the retry
 */
export async function generateJsonWithRetry(provider, opts, validate) {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const text = await provider.generateText({
                ...opts,
                json: true,
                temperature: attempt === 0 ? 0.3 : 0.1,
            });
            const obj = JSON.parse(stripFences(text));
            if (validate(obj)) return obj;
        } catch {
            // fall through to retry / null
        }
    }
    return null;
}
