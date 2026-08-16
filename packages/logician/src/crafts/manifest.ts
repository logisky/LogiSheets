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
export type MutatesPolicy = 'none' | 'temp' | true

export interface ManifestTool {
    name: string
    description: string
    inputSchema: JSONSchema
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
    description: string
    guidance?: string
}

export interface CraftManifest {
    schemaVersion: 1
    craftId: string
    version: string
    label: string
    url?: string
    rtJs?: string
    skill?: ManifestSkill
    tools?: ManifestTool[]
}
