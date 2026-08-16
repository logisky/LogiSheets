/**
 * The bridge between Watson and installed crafts.
 *
 * Two meta-tools implement progressive discovery (keeps the LLM tool list
 * bounded as the plugin ecosystem grows):
 *
 *   skills__discover  →  list installed crafts + their "when to use me" line
 *   skills__use       →  load one craft's tools into the live registry so the
 *                        model can call them on the next turn
 *
 * A loaded craft tool dispatches straight to the craft module's named export,
 * passing the same ToolContext the built-in tools receive — which is exactly the
 * craft's `ctx` (workbook / signal / confirm / log). One function, three callers.
 */

import {toolId} from '../tool.js'
import type {
    CraftStateAccess,
    JSONSchema,
    Tool,
    ToolRegistry,
} from '../tool.js'
import type {InstalledCraftStore} from './store.js'
import type {ManifestTool} from './manifest.js'

/** Host capability: build a craftState accessor scoped to one craft. */
export type CraftStateProvider = (craftId: string) => CraftStateAccess

export interface CraftSkillToolsOptions {
    /** Wires ctx.craftState for dispatched craft tools, scoped per craft. */
    craftState?: CraftStateProvider
}

/** Anthropic tool names allow [A-Za-z0-9_-] only — no dots. */
function sanitizeNamespace(craftId: string): string {
    return craftId.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/** Build a live Tool that dispatches to a craft module's exported function. */
export function craftToolFromManifest(
    craftId: string,
    mt: ManifestTool,
    store: InstalledCraftStore,
    craftState?: CraftStateProvider
): Tool {
    return {
        namespace: sanitizeNamespace(craftId),
        name: mt.name,
        description: mt.description,
        inputSchema: mt.inputSchema as JSONSchema,
        mutates: mt.mutates !== 'none',
        confirmation: mt.confirmation,
        handler: async (input, ctx) => {
            const mod = await store.load(craftId, mt.entry)
            const fn = mod[mt.export]
            if (typeof fn !== 'function')
                throw new Error(
                    `craft "${craftId}" has no exported function "${mt.export}" in ${mt.entry}`
                )
            const args = mt.paramOrder.map(
                (p) => (input as Record<string, unknown> | undefined)?.[p]
            )
            // Scope craftState to THIS craft before handing the ctx to it.
            const craftCtx = craftState
                ? {...ctx, craftState: craftState(craftId)}
                : ctx
            // ctx is the craft's first (host-injected) parameter.
            const data = await (fn as (...a: unknown[]) => Promise<unknown>)(
                craftCtx,
                ...args
            )
            return {data: data ?? null}
        },
    }
}

const DISCOVER_DESCRIPTION =
    'List installed crafts and what each is good at. Call this FIRST when a task ' +
    'might be handled by a craft/plugin, then call skills__use to load the ' +
    'chosen craft\'s tools. Optional `query` filters by keyword.'

const USE_DESCRIPTION =
    "Load an installed craft's tools into this conversation so you can call them. " +
    'Pass the `craftId` from skills__discover. Returns the loaded tool names and ' +
    "the craft's usage guidance; the tools become callable on your next step."

/**
 * The two discovery/loading meta-tools. Register these into the same registry
 * the Agent uses; `skills__use` registers craft tools into it on demand, and the
 * agent loop re-lists tools every request so they surface immediately.
 */
export function makeCraftSkillTools(
    store: InstalledCraftStore,
    registry: ToolRegistry,
    opts: CraftSkillToolsOptions = {}
): Tool[] {
    const discover: Tool = {
        namespace: 'skills',
        name: 'discover',
        description: DISCOVER_DESCRIPTION,
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Optional keyword to filter crafts by.',
                },
            },
        },
        mutates: false,
        confirmation: 'never',
        handler: async (input) => {
            const rows = await store.list()
            const q = (input as {query?: string} | undefined)?.query
                ?.toString()
                .toLowerCase()
            const filtered = q
                ? rows.filter((s) =>
                      `${s.label} ${s.craftId} ${s.description ?? ''}`
                          .toLowerCase()
                          .includes(q)
                  )
                : rows
            return {
                data: filtered.map((s) => ({
                    craftId: s.craftId,
                    label: s.label,
                    when: s.description ?? null,
                })),
                display: `${filtered.length} craft(s) available`,
            }
        },
    }

    const use: Tool = {
        namespace: 'skills',
        name: 'use',
        description: USE_DESCRIPTION,
        inputSchema: {
            type: 'object',
            properties: {
                craftId: {
                    type: 'string',
                    description: 'The craft to load, from skills__discover.',
                },
            },
            required: ['craftId'],
        },
        mutates: false,
        confirmation: 'never',
        handler: async (input) => {
            const craftId = (input as {craftId?: string} | undefined)?.craftId
            if (!craftId) throw new Error('craftId is required')
            const manifest = await store.get(craftId)
            if (!manifest)
                throw new Error(`craft "${craftId}" is not installed`)
            const tools = manifest.tools ?? []
            const loaded: string[] = []
            for (const mt of tools) {
                const tool = craftToolFromManifest(
                    craftId,
                    mt,
                    store,
                    opts.craftState
                )
                if (!registry.get(toolId(tool))) registry.register(tool)
                loaded.push(toolId(tool))
            }
            return {
                data: {
                    craftId,
                    label: manifest.label,
                    guidance: manifest.skill?.guidance ?? null,
                    tools: loaded,
                },
                display:
                    `Loaded ${loaded.length} tool(s) from "${manifest.label}"` +
                    (manifest.skill?.guidance ? ' — see guidance' : ''),
            }
        },
    }

    return [discover, use]
}

/** Convenience: build and register the two meta-tools into `registry`. */
export function installCraftSkillTools(
    store: InstalledCraftStore,
    registry: ToolRegistry,
    opts: CraftSkillToolsOptions = {}
): void {
    registry.registerMany(makeCraftSkillTools(store, registry, opts))
}
