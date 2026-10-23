/**
 * The craft capability manifest — the wire contract Watson reads to discover a
 * craft's skill and invoke its tools. Produced by the `craftsmith` CLI as
 * `dist/manifest.json`. Mirrored here (rather than imported from `craftsmith`)
 * so `logician` stays free of any build-tooling dependency — the same way the
 * `Tool` / JSONSchema shapes are self-contained.
 *
 * Keep in sync with packages/craftsmith/src/manifest.ts.
 */

import type {JSONSchema, ConfirmationPolicy} from '../tool.js'

// ConfirmationPolicy is re-used from tool.js (not re-exported — the barrel would
// clash). MutatesPolicy is manifest-specific.
/**
 * Whether/how a craft tool mutates the workbook. `craftToolFromManifest` maps
 * anything but 'none' (so 'temp' too) to `Tool.mutates = true`, and `askAi`
 * refuses any such tool.
 */
export type MutatesPolicy = 'none' | 'temp' | true

export interface ManifestTool {
    /** LLM-facing tool name (snake_case, no "__"); the namespace is the
     *  sanitized craft id. */
    name: string
    /** One-line description; the model uses this to decide when to call. */
    description: string
    /** JSON Schema for the argument object the LLM produces. */
    inputSchema: JSONSchema
    /** Documentation only — never sent to the model. */
    outputSchema?: JSONSchema
    /** Parameter names in call order: fn(ctx, ...paramOrder.map(p => args[p])). */
    paramOrder: string[]
    /** Module the function lives in, relative to the craft package root. */
    entry: string
    /** Exported binding name = the dispatch key. */
    export: string
    mutates: MutatesPolicy
    confirmation: ConfirmationPolicy
}

export interface ManifestSkill {
    /** "When to use this craft" — what `skills__discover` shows. */
    description: string
    /** Prompt fragment returned by `skills__use` once the craft is loaded. */
    guidance?: string
}

/** One question the craft can put to a model — see logician's `askAi`. */
export interface ManifestRole {
    /** The name `craftAi.ask(role, …)` selects. */
    name: string
    /** System prompt, sent verbatim. */
    system: string
    /** JSON Schema the reply must satisfy. */
    replySchema: JSONSchema
    /** Exported name of the reply's TS declaration (codegen only). */
    replyType: string
}

export interface CraftManifest {
    schemaVersion: 1
    craftId: string
    version: string
    label: string
    /** The name per language, when the package gives one. */
    labels?: Record<string, string>
    description?: string
    /** Published, but left out of a host's browse list. */
    unlisted?: boolean
    /** Unverified free text from the package. */
    publisher?: string
    /** Lowest host API version the craft needs. */
    hostApi?: number
    /** Host capabilities the craft cannot run without (e.g. dataConnections). */
    requires?: string[]
    /** Every file in a packed `.craft` (absent from dist/manifest.json). */
    files?: string[]
    /** Present iff the craft has an index.html. Package-relative. */
    url?: string
    /** Present iff the craft has a runtime.ts (CraftRuntime lifecycle). */
    rtJs?: string
    /** Present iff the craft exposes tools (a tools.ts with @logicianSkill). */
    skill?: ManifestSkill
    /** One per @tool. Empty/absent for UI-only crafts. */
    tools?: ManifestTool[]
    /** One per @aiRole. Its presence is what permits `craftAi.ask`. */
    roles?: ManifestRole[]
}
