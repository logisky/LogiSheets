/**
 * LLM providers Watson can talk to.
 *
 * Two wire formats reach every provider here. Anthropic's `/v1/messages` is
 * the one logician's agent IR is already shaped like, so those providers need
 * no translation; OpenAI's `/chat/completions` is the other half of the
 * industry, and `llm-openai.ts` translates for it. A provider entry is
 * therefore mostly a base URL, an auth style, and a model list — adding one is
 * this file and nothing else.
 *
 * Base URLs are editable per provider (stored on the device), which is what
 * makes the local servers and the regional hosts work: point Ollama at
 * whatever port it runs on, switch Moonshot between its global
 * (`api.moonshot.ai`) and China (`api.moonshot.cn`) sites, or aim any of them
 * at a proxy to sidestep browser CORS.
 */

export type ProviderId =
    | 'anthropic'
    | 'kimi'
    | 'openai'
    | 'deepseek'
    | 'openrouter'
    | 'ollama'

export interface ModelOption {
    id: string
    label: string
}

export interface ProviderDef {
    id: ProviderId
    /**
     * Which HTTP API this provider speaks. `'anthropic'` is `/v1/messages`
     * (no translation needed); `'openai'` is `/chat/completions`.
     */
    wire: 'anthropic' | 'openai'
    /** Default API base URL (no trailing `/v1/messages` or
     *  `/chat/completions`). User-overridable. */
    baseUrl: string
    /** How the API key is sent. Ignored on the OpenAI wire, which is always
     *  `Authorization: Bearer`. */
    auth: 'x-api-key' | 'bearer'
    /** Whether Anthropic's `dangerous-direct-browser-access` header applies.
     *  Anthropic's own API requires it; nothing else knows it. */
    directBrowserAccess: boolean
    /**
     * Known to reject browser-origin calls for lack of CORS headers. Drives a
     * warning in settings, so set it only where it is actually true — a
     * warning on a provider that works is noise the user learns to ignore.
     */
    corsBlocked?: boolean
    /** False for a local server that authenticates nobody. */
    requiresKey?: boolean
    /**
     * OpenAI's reasoning models reject `max_tokens` and want
     * `max_completion_tokens`; everything else still takes the old name.
     */
    maxTokensParam?: 'max_tokens' | 'max_completion_tokens'
    /**
     * Translation KEYS, not text — this table is module-level and the language
     * changes under it. The settings modal resolves them. Model names and key
     * formats (`sk-ant-…`) are not translated: they are literals a user copies.
     */
    label: string
    keyLabel: string
    /** A literal, not a key: it shows the SHAPE of a key (`sk-ant-…`). */
    keyPlaceholder: string
    /** Optional one-line hint shown under the key field. */
    note?: string
    /** Suggested models (free text is still allowed via the datalist). */
    models: ModelOption[]
    defaultModel: string
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
    anthropic: {
        id: 'anthropic',
        label: 'watson.providers.anthropic',
        wire: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        auth: 'x-api-key',
        directBrowserAccess: true,
        keyLabel: 'watson.providers.anthropicKey',
        keyPlaceholder: 'sk-ant-…',
        models: [
            {id: 'claude-opus-5', label: 'Claude Opus 5'},
            {id: 'claude-sonnet-5', label: 'Claude Sonnet 5'},
            {id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5'},
            {id: 'claude-opus-4-8', label: 'Claude Opus 4.8'},
        ],
        defaultModel: 'claude-opus-5',
    },
    kimi: {
        id: 'kimi',
        label: 'watson.providers.kimi',
        wire: 'anthropic',
        baseUrl: 'https://api.moonshot.ai/anthropic',
        auth: 'bearer',
        directBrowserAccess: false,
        corsBlocked: true,
        keyLabel: 'watson.providers.kimiKey',
        keyPlaceholder: 'sk-…',
        note: 'watson.providers.kimiNote',
        models: [
            {id: 'kimi-k2-0905-preview', label: 'Kimi K2 (0905)'},
            {id: 'kimi-k2-turbo-preview', label: 'Kimi K2 Turbo'},
            {id: 'kimi-k2-0711-preview', label: 'Kimi K2 (0711)'},
            {id: 'kimi-latest', label: 'Kimi Latest'},
        ],
        defaultModel: 'kimi-k2-0905-preview',
    },
    openai: {
        id: 'openai',
        label: 'watson.providers.openai',
        wire: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        auth: 'bearer',
        directBrowserAccess: false,
        // Reasoning models reject `max_tokens` outright, and they are the ones
        // worth pointing an agent at, so this provider uses the newer name.
        maxTokensParam: 'max_completion_tokens',
        keyLabel: 'watson.providers.openaiKey',
        keyPlaceholder: 'sk-…',
        models: [
            {id: 'gpt-5', label: 'GPT-5'},
            {id: 'gpt-5-mini', label: 'GPT-5 mini'},
            {id: 'gpt-4.1', label: 'GPT-4.1'},
            {id: 'o4-mini', label: 'o4-mini'},
        ],
        defaultModel: 'gpt-5',
    },
    deepseek: {
        id: 'deepseek',
        label: 'watson.providers.deepseek',
        wire: 'openai',
        baseUrl: 'https://api.deepseek.com',
        auth: 'bearer',
        directBrowserAccess: false,
        keyLabel: 'watson.providers.deepseekKey',
        keyPlaceholder: 'sk-…',
        models: [
            {id: 'deepseek-chat', label: 'DeepSeek Chat'},
            {id: 'deepseek-reasoner', label: 'DeepSeek Reasoner'},
        ],
        defaultModel: 'deepseek-chat',
    },
    openrouter: {
        id: 'openrouter',
        label: 'watson.providers.openrouter',
        wire: 'openai',
        baseUrl: 'https://openrouter.ai/api/v1',
        auth: 'bearer',
        directBrowserAccess: false,
        keyLabel: 'watson.providers.openrouterKey',
        keyPlaceholder: 'sk-or-…',
        note: 'watson.providers.openrouterNote',
        models: [
            {id: 'anthropic/claude-opus-4.5', label: 'Claude Opus 4.5'},
            {id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro'},
            {id: 'openai/gpt-5', label: 'GPT-5'},
            {id: 'qwen/qwen3-235b-a22b', label: 'Qwen3 235B'},
        ],
        defaultModel: 'anthropic/claude-opus-4.5',
    },
    ollama: {
        id: 'ollama',
        label: 'watson.providers.ollama',
        wire: 'openai',
        baseUrl: 'http://localhost:11434/v1',
        auth: 'bearer',
        directBrowserAccess: false,
        // A local server authenticates nobody; demanding a key here would be
        // a made-up obstacle.
        requiresKey: false,
        keyLabel: 'watson.providers.ollamaKey',
        keyPlaceholder: '',
        note: 'watson.providers.ollamaNote',
        models: [
            {id: 'qwen3:32b', label: 'Qwen3 32B'},
            {id: 'llama3.3:70b', label: 'Llama 3.3 70B'},
            {id: 'mistral-small3.2', label: 'Mistral Small 3.2'},
        ],
        defaultModel: 'qwen3:32b',
    },
}

export const DEFAULT_PROVIDER: ProviderId = 'anthropic'

export function isProviderId(v: string | null | undefined): v is ProviderId {
    return v != null && Object.prototype.hasOwnProperty.call(PROVIDERS, v)
}

/** Whether this provider needs a key before a turn can run. */
export function providerRequiresKey(p: ProviderId): boolean {
    return PROVIDERS[p].requiresKey ?? true
}

// --- device-scoped storage (keys/base URL are per provider) -----------------

const LEGACY_KEY = 'watson.apiKey'

export function keyStorageKey(p: ProviderId): string {
    return `watson.apiKey.${p}`
}

export function baseUrlStorageKey(p: ProviderId): string {
    return `watson.baseUrl.${p}`
}

/** Current provider's key, migrating the pre-provider `watson.apiKey`. */
export function loadStoredKey(p: ProviderId): string {
    const k = localStorage.getItem(keyStorageKey(p))
    if (k != null) return k
    if (p === 'anthropic') return localStorage.getItem(LEGACY_KEY) || ''
    return ''
}

/** Current provider's base URL, falling back to its built-in default. */
export function loadStoredBaseUrl(p: ProviderId): string {
    return localStorage.getItem(baseUrlStorageKey(p)) || PROVIDERS[p].baseUrl
}
