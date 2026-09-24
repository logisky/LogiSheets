/**
 * `window.craftAi` — the host side of the craft→AI channel.
 *
 * A craft declares roles (`@aiRole`) in its manifest; this resolves one by
 * name, hands the model that craft's read-only tools, and runs `askAi` to a
 * schema-valid answer. The craft never sees a key, a provider or a model: it
 * asks a question, the host decides who answers it.
 *
 * See design/craft-ai-channel.md.
 */

import {
    askAi,
    craftToolFromManifest,
    type AiRole,
    type CraftManifest,
    type InstalledCraftStore,
    type Tool,
    type ToolContext,
    type WorkbookClient,
} from 'logisheets-logician'
import {
    loadLlmSettings,
    llmConfigured,
    makeLlmClient,
} from '@/components/watson/lib/llm-factory'
import {modelForTier} from '@/components/watson/lib/providers'
import {globalStore} from '@/store'

export type AiUnavailable = 'no-key' | 'denied' | 'offline' | 'unsupported'
export type AiAvailability = {ok: true} | {ok: false; reason: AiUnavailable}

export interface AskOpts {
    tier?: 'fast' | 'default'
    signal?: AbortSignal
}

export interface CraftAi {
    available(): Promise<AiAvailability>
    ask(role: string, input: string, opts?: AskOpts): Promise<unknown>
    /**
     * Ask the host to open its own LLM setup, for a craft that found
     * `available()` false and wants to offer the user a way out.
     *
     * Deliberately takes nothing and returns nothing: the craft cannot pass a
     * key, cannot read one back, and cannot tell whether the user went
     * through with it — it re-checks `available()` like anyone else. The host
     * owns the credential and the UI for it.
     */
    configure(): void
}

/** `/lights-out/index.html` → `lights-out`. The panel keys crafts by URL. */
export function craftIdFromSrc(src: string): string {
    return src.replace(/^\/+/, '').replace(/\/index\.html.*$/, '')
}

export interface CraftAiDeps {
    craftId: string
    store: InstalledCraftStore
    workbook: WorkbookClient
    /** Ask the user once per craft. Resolves false if they decline. */
    requestConsent: (
        craftId: string,
        roles: readonly AiRole[]
    ) => Promise<boolean>
    /** Host chrome: an in-flight indicator the user can stop. */
    onBusy?: (busy: boolean) => void
    log?: (msg: string) => void
}

function rolesOf(manifest: CraftManifest | undefined): AiRole[] {
    return (manifest?.roles ?? []).map((r) => ({
        name: r.name,
        system: r.system,
        replySchema: r.replySchema,
    }))
}

/**
 * The craft's own read tools, as the model will see them. A mutating tool is
 * left out here rather than rejected later: the model gathers, the craft acts.
 */
function readToolsOf(
    manifest: CraftManifest | undefined,
    craftId: string,
    store: InstalledCraftStore
): Tool[] {
    return (manifest?.tools ?? [])
        .filter((t) => t.mutates === 'none')
        .map((t) => craftToolFromManifest(craftId, t, store))
}

export function makeCraftAi(deps: CraftAiDeps): CraftAi {
    const {craftId, store, workbook} = deps
    let consented: boolean | undefined

    const manifest = () => store.get(craftId)

    const available = async (): Promise<AiAvailability> => {
        const m = await manifest()
        if (!rolesOf(m).length) return {ok: false, reason: 'unsupported'}
        if (!llmConfigured()) return {ok: false, reason: 'no-key'}
        if (consented === false) return {ok: false, reason: 'denied'}
        return {ok: true}
    }

    return {
        available,
        configure: () => globalStore.requestLlmSetup(),
        async ask(roleName, input, opts) {
            const m = await manifest()
            const roles = rolesOf(m)
            const role = roles.find((r) => r.name === roleName)
            if (!role)
                throw new Error(
                    `craft "${craftId}" declares no @aiRole named "${roleName}"` +
                        (roles.length
                            ? `; it has ${roles.map((r) => r.name).join(', ')}`
                            : '')
                )

            const settings = loadLlmSettings()
            if (!llmConfigured(settings))
                throw new Error(
                    'no AI provider is configured — open the assistant panel and add a key'
                )

            if (consented === undefined)
                consented = await deps.requestConsent(craftId, roles)
            if (!consented)
                throw new Error(
                    `the user has not allowed "${craftId}" to use AI`
                )

            const ctx: ToolContext = {
                workbook,
                signal: opts?.signal ?? new AbortController().signal,
                // A read-only loop never reaches a tool that would ask.
                confirm: async () => true,
                log: deps.log ?? (() => {}),
            }

            deps.onBusy?.(true)
            try {
                return await askAi({
                    llm: makeLlmClient(
                        settings.provider,
                        settings.baseUrl,
                        () => loadLlmSettings().apiKey || null
                    ),
                    // The craft says how much the question is worth, not who
                    // answers it: a draft pick runs on the provider's cheap
                    // model, a committed move on the configured one.
                    model: modelForTier(
                        settings.provider,
                        settings.model,
                        opts?.tier
                    ),
                    role,
                    input,
                    tools: readToolsOf(m, craftId, store),
                    ctx,
                })
            } finally {
                deps.onBusy?.(false)
            }
        },
    }
}
