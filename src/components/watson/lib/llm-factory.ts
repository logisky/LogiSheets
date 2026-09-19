/**
 * Building an `LlmClient` from the user's stored provider settings.
 *
 * Two callers need this and must not drift: the Watson panel, and the craft AI
 * channel (`window.craftAi`). Provider handling — which wire format speaks for
 * a provider, where its key and base URL live, and the desktop's native-fetch
 * detour around CORS — belongs in one place.
 */

import type {LlmClient} from 'logisheets-logician'
import {AnthropicBrowserClient} from './llm-anthropic'
import {OpenAiBrowserClient} from './llm-openai'
import {getFetch} from './net'
import {
    PROVIDERS,
    DEFAULT_PROVIDER,
    isProviderId,
    loadStoredKey,
    loadStoredBaseUrl,
    providerRequiresKey,
    type ProviderId,
} from './providers'

const KEY_PROVIDER = 'watson.provider'
const KEY_MODEL = 'watson.model'

export interface LlmSettings {
    provider: ProviderId
    model: string
    apiKey: string
    baseUrl: string
}

/** What the user has configured, as the craft channel sees it. */
export function loadLlmSettings(): LlmSettings {
    const stored = localStorage.getItem(KEY_PROVIDER)
    const provider = isProviderId(stored) ? stored : DEFAULT_PROVIDER
    const p = PROVIDERS[provider]
    return {
        provider,
        model: localStorage.getItem(KEY_MODEL) || p.defaultModel,
        apiKey: loadStoredKey(provider),
        baseUrl: loadStoredBaseUrl(provider),
    }
}

/** Whether a request could actually be sent right now. */
export function llmConfigured(s: LlmSettings = loadLlmSettings()): boolean {
    return !providerRequiresKey(s.provider) || s.apiKey.length > 0
}

/**
 * `apiKey` is a getter, not a value: the panel lets the user change the key
 * mid-session and every later request should use the new one.
 */
export function makeLlmClient(
    provider: ProviderId,
    baseUrl: string,
    apiKey: () => string | null
): LlmClient {
    const p = PROVIDERS[provider]
    const fetchImpl = getFetch()
    return p.wire === 'openai'
        ? new OpenAiBrowserClient({
              apiKey,
              baseUrl: baseUrl || p.baseUrl,
              requiresKey: p.requiresKey,
              maxTokensParam: p.maxTokensParam,
              fetchImpl,
          })
        : new AnthropicBrowserClient({
              apiKey,
              baseUrl: baseUrl || p.baseUrl,
              authHeader: p.auth,
              directBrowserAccess: p.directBrowserAccess,
              fetchImpl,
          })
}
