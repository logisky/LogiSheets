// Bring the host's enum registry in line with the workbook's own.
//
// The engine owns the enum sets now — ids and labels, persisted in
// `logisheets/data.xml` — because a field declaring `enum{setId}` names a list
// it does not carry, and no host but the browser could see that list while it
// lived in the AppData blob (see design/block-field-semantics.md §4).
//
// The host registry keeps one thing the engine deliberately does not: the
// COLOUR of each variant, which is presentation. So on file open the two are
// merged — options from the workbook, colours from whatever the host had — and
// the result is what the dropdown renders.
//
// Without this, a workbook authored headless (through the MCP server, or a Node
// runtime) would open in the browser with its enum fields validated correctly
// by the engine and yet showing an empty dropdown, because the host had never
// heard of the set.

import {isErrorMessage} from 'logisheets-web/pure'
import type {Client, EnumSetInfo} from 'logisheets-web/pure'
import type {EnumVariant} from 'logisheets-engine'

/** The subset of the host registry this needs. */
export interface EnumRegistry {
    get(id: string): {variants: EnumVariant[]} | undefined
    set(
        id: string,
        name: string,
        variants: EnumVariant[],
        description?: string
    ): unknown
}

/** A palette to colour a variant the host has never seen before. */
const PALETTE = [
    '#3b82f6',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#a855f7',
    '#06b6d4',
    '#ec4899',
    '#84cc16',
]

export interface HydrateResult {
    /** Sets adopted from the workbook. */
    sets: number
    /** Variants that had no host colour and were given one. */
    coloured: number
}

/**
 * Merge every enum set the workbook holds into `registry`.
 *
 * The workbook decides which sets exist and which options each has — it is the
 * thing that persists, and the thing the engine's membership rule is generated
 * from. The host contributes only colour, and only where it already had one for
 * that variant id: a colour is a preference, so keeping the user's beats
 * re-rolling it, but a new option cannot go unrendered waiting for one.
 */
export async function hydrateEnumSetsFromWorkbook(
    client: Client,
    registry: EnumRegistry
): Promise<HydrateResult> {
    const result: HydrateResult = {sets: 0, coloured: 0}

    const sets = await client.getEnumSets()
    if (isErrorMessage(sets)) return result

    for (const set of sets as readonly EnumSetInfo[]) {
        const existing = registry.get(set.id)
        const colourOf = new Map(
            (existing?.variants ?? []).map((v) => [v.id, v.color])
        )
        const variants: EnumVariant[] = set.variants.map((v, i) => {
            const held = colourOf.get(v.id)
            if (!held) result.coloured += 1
            return {
                id: v.id,
                value: v.label,
                color: held ?? PALETTE[i % PALETTE.length],
            }
        })
        registry.set(set.id, set.name || set.id, variants)
        result.sets += 1
    }

    return result
}
