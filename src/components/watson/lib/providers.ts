/**
 * LLM providers Watson can talk to.
 *
 * Every provider here speaks the Anthropic Messages wire format (`/v1/messages`,
 * `system` / `messages` / `tools`), so they all share the one
 * `AnthropicBrowserClient` — a provider only differs in base URL, auth header
 * style, whether Anthropic's browser-access header applies, and its model list.
 *
 * Kimi (Moonshot) exposes an Anthropic-compatible endpoint, so it drops in with
 * `authHeader: 'bearer'` and no browser-access header. The base URL is editable
 * per provider (stored on the device) so users can switch between the global
 * (`api.moonshot.ai`) and China (`api.moonshot.cn`) hosts, or point at a proxy
 * to sidestep browser CORS.
 */

export type ProviderId = 'anthropic' | 'kimi'

export interface ModelOption {
    id: string
    label: string
}

export interface ProviderDef {
    id: ProviderId
    label: string
    /** Default API base URL (no trailing `/v1/messages`). User-overridable. */
    baseUrl: string
    /** How the API key is sent. */
    auth: 'x-api-key' | 'bearer'
    /** Whether Anthropic's `dangerous-direct-browser-access` header applies. */
    directBrowserAccess: boolean
    keyLabel: string
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
        label: 'Anthropic (Claude)',
        baseUrl: 'https://api.anthropic.com',
        auth: 'x-api-key',
        directBrowserAccess: true,
        keyLabel: 'Anthropic API key',
        keyPlaceholder: 'sk-ant-…',
        models: [
            {id: 'claude-opus-4-8', label: 'Claude Opus 4.8'},
            {id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5'},
            {id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5'},
        ],
        defaultModel: 'claude-opus-4-8',
    },
    kimi: {
        id: 'kimi',
        label: 'Kimi (Moonshot)',
        baseUrl: 'https://api.moonshot.ai/anthropic',
        auth: 'bearer',
        directBrowserAccess: false,
        keyLabel: 'Moonshot API key',
        keyPlaceholder: 'sk-…',
        note: 'Moonshot’s Anthropic-compatible endpoint. China site: https://api.moonshot.cn/anthropic.',
        models: [
            {id: 'kimi-k2-0905-preview', label: 'Kimi K2 (0905)'},
            {id: 'kimi-k2-turbo-preview', label: 'Kimi K2 Turbo'},
            {id: 'kimi-k2-0711-preview', label: 'Kimi K2 (0711)'},
            {id: 'kimi-latest', label: 'Kimi Latest'},
        ],
        defaultModel: 'kimi-k2-0905-preview',
    },
}

export const DEFAULT_PROVIDER: ProviderId = 'anthropic'

export function isProviderId(v: string | null | undefined): v is ProviderId {
    return v === 'anthropic' || v === 'kimi'
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
