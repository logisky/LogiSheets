/**
 * Craft-interaction tools — let Watson BUILD craft-style cell-overlay
 * widgets onto blocks, the way factory-simulator does, and READ back what
 * the end user selected.
 *
 * Model (mirrors `injectCraftInteractionAPIs` in the host): a craft
 * *registers* an overlay group onto specific block cells, then the end
 * user operates it by clicking (choosing a radio option, dragging a
 * slider, splitting a percentage). The craft cannot set selections
 * programmatically — so these tools cover registration + clearing +
 * reading results, not "operate".
 *
 * Addressing: cells are named by (block ref name, field name, row key) —
 * the same altitude as `edit__set_block_cells`. Each tool resolves those
 * to block-relative (row, col) offsets via the block schema before
 * calling the host. The LLM never deals with raw coordinates.
 *
 * When the host has no craft-interaction surface (headless CLI), the
 * tools return a structured "not available" result instead of throwing.
 */

import {isErrorMessage} from 'logisheets-web'
import type {BlockInfo, Client} from 'logisheets-web'
import type {CraftInteractionsApi} from '../craft-interactions-api'
import type {JSONSchema, Tool, ToolContext, ToolResult} from '../tool'

function asClient(ctx: ToolContext): Client {
    return ctx.workbook as Client
}

/** Resolve the craft surface or produce a "not available" result. */
function requireApi(
    ctx: ToolContext
): {api: CraftInteractionsApi} | {unavailable: ToolResult} {
    const api = ctx.craftInteractions
    if (!api) {
        return {
            unavailable: {
                data: {available: false},
                display: 'Craft interactions are not available in this host.',
            },
        }
    }
    return {api}
}

/** Block + its resolved coordinates, used while translating a cell ref. */
interface ResolvedBlock {
    block: BlockInfo
    sheetIdx: number
    blockId: number
}

/** Fetch all blocks once and index by schema ref name. */
async function loadBlocksByName(
    client: Client
): Promise<Map<string, ResolvedBlock>> {
    const all = await client.getAllBlocks({})
    if (isErrorMessage(all)) {
        throw new Error(`getAllBlocks failed: ${all.msg}`)
    }
    const byName = new Map<string, ResolvedBlock>()
    for (const b of all) {
        if (b.schema?.name) {
            byName.set(b.schema.name, {
                block: b,
                sheetIdx: b.sheetIdx,
                blockId: b.blockId,
            })
        }
    }
    return byName
}

/** Resolve (field, row_key) → block-relative (row, col) via the schema. */
function resolveCell(
    rb: ResolvedBlock,
    blockRef: string,
    rowKey: string,
    field: string
): {sheetIdx: number; blockId: number; row: number; col: number} {
    const schema = rb.block.schema
    if (!schema) {
        throw new Error(`block "${blockRef}" has no schema`)
    }
    const rowEntry = schema.keys.find((k) => k.key === rowKey)
    if (!rowEntry) {
        throw new Error(
            `no row with key "${rowKey}" in block "${blockRef}" (keys: ${schema.keys
                .map((k) => k.key)
                .join(', ')})`
        )
    }
    const fieldEntry = schema.fields.find((f) => f.field === field)
    if (!fieldEntry) {
        throw new Error(
            `no field "${field}" in block "${blockRef}" (fields: ${schema.fields
                .map((f) => f.field)
                .join(', ')})`
        )
    }
    return {
        sheetIdx: rb.sheetIdx,
        blockId: rb.blockId,
        row: rowEntry.idx,
        col: fieldEntry.idx,
    }
}

// ---------------------------------------------------------------------------
// Shared JSON Schema fragments
// ---------------------------------------------------------------------------

const GROUP_ID_SCHEMA: JSONSchema = {
    type: 'string',
    description:
        'A craft-chosen id for this overlay group. Cells sharing a group_id interact together (one radio choice, one percent split, one point pool).',
}

const CELL_REF_SCHEMA: JSONSchema = {
    type: 'object',
    description: 'Addresses a block cell by field name and row key.',
    properties: {
        row_key: {type: 'string', description: "Value of the block's key column."},
        field: {type: 'string'},
    },
    required: ['row_key', 'field'],
}

const VALUED_CELL_REF_SCHEMA: JSONSchema = {
    type: 'object',
    properties: {
        row_key: {type: 'string'},
        field: {type: 'string'},
        value: {
            type: 'string',
            description:
                'The option value this cell represents when chosen (radio/multi-select).',
        },
    },
    required: ['row_key', 'field', 'value'],
}

interface CellRef {
    row_key: string
    field: string
}
interface ValuedCellRef extends CellRef {
    value: string
}

// ===========================================================================
// REGISTER (build)
// ===========================================================================

interface RegisterRadioInput {
    group_id: string
    block: string
    options: ReadonlyArray<ValuedCellRef>
}

const registerRadioGroup: Tool<RegisterRadioInput> = {
    namespace: 'craft',
    name: 'register_radio_group',
    description: [
        'Bind a single-choice radio overlay across a set of block cells. Each option is a cell; clicking one selects it and deselects the others in the group. Re-registering the same group_id replaces it.',
    ].join('\n'),
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            group_id: GROUP_ID_SCHEMA,
            block: {type: 'string', description: 'Block ref name.'},
            options: {
                type: 'array',
                items: VALUED_CELL_REF_SCHEMA,
                minItems: 1,
            },
        },
        required: ['group_id', 'block', 'options'],
    },
    handler: async (input, ctx) => {
        const r = requireApi(ctx)
        if ('unavailable' in r) return r.unavailable
        const {api} = r
        const blocks = await loadBlocksByName(asClient(ctx))
        const rb = blocks.get(input.block)
        if (!rb) throw new Error(`no block with ref name "${input.block}"`)

        // Resolve all cells first; only mutate host state if all succeed.
        const resolved = input.options.map((o) => ({
            ...resolveCell(rb, input.block, o.row_key, o.field),
            value: o.value,
        }))
        api.clearRadios(input.group_id)
        for (const c of resolved) {
            api.registerRadio({groupId: input.group_id, ...c})
        }
        return {
            data: {group_id: input.group_id, options: resolved.length},
            display: `Registered radio group "${input.group_id}" (${resolved.length} options).`,
        }
    },
}

interface RegisterMultiInput {
    group_id: string
    block: string
    max: number
    options: ReadonlyArray<ValuedCellRef>
}

const registerMultiSelectGroup: Tool<RegisterMultiInput> = {
    namespace: 'craft',
    name: 'register_multi_select_group',
    description: [
        'Bind a k-of-n multi-select overlay across block cells. The user can select up to `max` of them. Re-registering the same group_id replaces it.',
    ].join('\n'),
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            group_id: GROUP_ID_SCHEMA,
            block: {type: 'string', description: 'Block ref name.'},
            max: {
                type: 'integer',
                minimum: 1,
                description: 'Maximum number of cells the user may select.',
            },
            options: {
                type: 'array',
                items: VALUED_CELL_REF_SCHEMA,
                minItems: 1,
            },
        },
        required: ['group_id', 'block', 'max', 'options'],
    },
    handler: async (input, ctx) => {
        const r = requireApi(ctx)
        if ('unavailable' in r) return r.unavailable
        const {api} = r
        const blocks = await loadBlocksByName(asClient(ctx))
        const rb = blocks.get(input.block)
        if (!rb) throw new Error(`no block with ref name "${input.block}"`)

        const resolved = input.options.map((o) => ({
            ...resolveCell(rb, input.block, o.row_key, o.field),
            value: o.value,
        }))
        api.clearMultiSelects(input.group_id)
        for (const c of resolved) {
            api.registerMultiSelect({groupId: input.group_id, ...c})
        }
        api.setMultiSelectMax(input.group_id, input.max)
        return {
            data: {
                group_id: input.group_id,
                max: input.max,
                options: resolved.length,
            },
            display: `Registered multi-select "${input.group_id}" (${resolved.length} options, max ${input.max}).`,
        }
    },
}

interface RegisterPointInput {
    group_id: string
    block: string
    pool_total: number
    cells: ReadonlyArray<CellRef>
}

const registerPointAllocator: Tool<RegisterPointInput> = {
    namespace: 'craft',
    name: 'register_point_allocator',
    description: [
        'Bind a point-allocator overlay: a pool of `pool_total` points the user distributes across the given cells (+/- on each cell). Re-registering the same group_id replaces it.',
    ].join('\n'),
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            group_id: GROUP_ID_SCHEMA,
            block: {type: 'string', description: 'Block ref name.'},
            pool_total: {type: 'integer', minimum: 0},
            cells: {type: 'array', items: CELL_REF_SCHEMA, minItems: 1},
        },
        required: ['group_id', 'block', 'pool_total', 'cells'],
    },
    handler: async (input, ctx) => {
        const r = requireApi(ctx)
        if ('unavailable' in r) return r.unavailable
        const {api} = r
        const blocks = await loadBlocksByName(asClient(ctx))
        const rb = blocks.get(input.block)
        if (!rb) throw new Error(`no block with ref name "${input.block}"`)

        const resolved = input.cells.map((c) =>
            resolveCell(rb, input.block, c.row_key, c.field)
        )
        api.clearPointAllocators(input.group_id)
        for (const c of resolved) {
            api.registerPointAllocator({groupId: input.group_id, ...c})
        }
        api.setPointPool(input.group_id, input.pool_total)
        return {
            data: {
                group_id: input.group_id,
                pool_total: input.pool_total,
                cells: resolved.length,
            },
            display: `Registered point allocator "${input.group_id}" (${resolved.length} cells, pool ${input.pool_total}).`,
        }
    },
}

interface RegisterPercentInput {
    group_id: string
    block: string
    cells: ReadonlyArray<CellRef>
}

const registerPercentAllocator: Tool<RegisterPercentInput> = {
    namespace: 'craft',
    name: 'register_percent_allocator',
    description: [
        'Bind a percent-allocator overlay across cells that must sum to 100%. The user clicks +/- to shift percentage between them; values are written to the cells. Typical use: a two-supplier split (factory-simulator does exactly this). Re-registering the same group_id replaces it.',
    ].join('\n'),
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            group_id: GROUP_ID_SCHEMA,
            block: {type: 'string', description: 'Block ref name.'},
            cells: {
                type: 'array',
                items: CELL_REF_SCHEMA,
                minItems: 2,
                description: 'The cells whose values must sum to 100%.',
            },
        },
        required: ['group_id', 'block', 'cells'],
    },
    handler: async (input, ctx) => {
        const r = requireApi(ctx)
        if ('unavailable' in r) return r.unavailable
        const {api} = r
        const blocks = await loadBlocksByName(asClient(ctx))
        const rb = blocks.get(input.block)
        if (!rb) throw new Error(`no block with ref name "${input.block}"`)

        const resolved = input.cells.map((c) =>
            resolveCell(rb, input.block, c.row_key, c.field)
        )
        api.clearPercentAllocators(input.group_id)
        for (const c of resolved) {
            api.registerPercentAllocator({groupId: input.group_id, ...c})
        }
        return {
            data: {group_id: input.group_id, cells: resolved.length},
            display: `Registered percent allocator "${input.group_id}" (${resolved.length} cells).`,
        }
    },
}

interface RegisterSliderInput {
    group_id: string
    block: string
    cell: CellRef
    min: number
    max: number
    step?: number
    initial_value?: number
}

const registerNumberSlider: Tool<RegisterSliderInput> = {
    namespace: 'craft',
    name: 'register_number_slider',
    description: [
        'Bind a number-slider overlay onto a single block cell. The user scrolls/types to set a value within [min,max]; the value is written to the cell. Re-registering the same group_id replaces it.',
    ].join('\n'),
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            group_id: GROUP_ID_SCHEMA,
            block: {type: 'string', description: 'Block ref name.'},
            cell: CELL_REF_SCHEMA,
            min: {type: 'number'},
            max: {type: 'number'},
            step: {type: 'number', description: 'Defaults to 1.'},
            initial_value: {type: 'number'},
        },
        required: ['group_id', 'block', 'cell', 'min', 'max'],
    },
    handler: async (input, ctx) => {
        const r = requireApi(ctx)
        if ('unavailable' in r) return r.unavailable
        const {api} = r
        if (input.min > input.max) {
            throw new Error(`min (${input.min}) must be <= max (${input.max})`)
        }
        const blocks = await loadBlocksByName(asClient(ctx))
        const rb = blocks.get(input.block)
        if (!rb) throw new Error(`no block with ref name "${input.block}"`)

        const c = resolveCell(rb, input.block, input.cell.row_key, input.cell.field)
        api.clearNumberSliders(input.group_id)
        api.registerNumberSlider({
            groupId: input.group_id,
            ...c,
            min: input.min,
            max: input.max,
            step: input.step,
            initialValue: input.initial_value,
        })
        return {
            data: {group_id: input.group_id, min: input.min, max: input.max},
            display: `Registered number slider "${input.group_id}" on ${input.block}[${input.cell.row_key}].${input.cell.field} ([${input.min}, ${input.max}]).`,
        }
    },
}

// ===========================================================================
// CLEAR
// ===========================================================================

type InteractionKind =
    | 'radio'
    | 'multi_select'
    | 'point'
    | 'percent'
    | 'number_slider'

interface ClearInput {
    kind: InteractionKind
    group_id: string
}

const clearInteraction: Tool<ClearInput> = {
    namespace: 'craft',
    name: 'clear_interaction',
    description:
        'Remove a single overlay group of a given kind. A group_id is required (no bulk wipe) to avoid clobbering unrelated overlays.',
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            kind: {
                type: 'string',
                enum: [
                    'radio',
                    'multi_select',
                    'point',
                    'percent',
                    'number_slider',
                ],
            },
            group_id: GROUP_ID_SCHEMA,
        },
        required: ['kind', 'group_id'],
    },
    handler: async (input, ctx) => {
        const r = requireApi(ctx)
        if ('unavailable' in r) return r.unavailable
        const {api} = r
        switch (input.kind) {
            case 'radio':
                api.clearRadios(input.group_id)
                break
            case 'multi_select':
                api.clearMultiSelects(input.group_id)
                break
            case 'point':
                api.clearPointAllocators(input.group_id)
                break
            case 'percent':
                api.clearPercentAllocators(input.group_id)
                break
            case 'number_slider':
                api.clearNumberSliders(input.group_id)
                break
        }
        return {
            data: {kind: input.kind, group_id: input.group_id, cleared: true},
            display: `Cleared ${input.kind} group "${input.group_id}".`,
        }
    },
}

// ===========================================================================
// READ user results
// ===========================================================================

interface ReadInput {
    kind: 'radio' | 'multi_select' | 'point'
    group_id: string
}

const readSelection: Tool<ReadInput> = {
    namespace: 'craft',
    name: 'read_selection',
    description: [
        'Read what the user has selected/allocated in an overlay group.',
        '  - radio: the chosen value (or null).',
        '  - multi_select: the chosen values.',
        '  - point: the pool (total/used/remaining) and per-cell allocations.',
        'Percent and number-slider values live in the cells themselves — read those with the normal cell/inspect tools.',
    ].join('\n'),
    mutates: false,
    confirmation: 'never',
    cost: 'cheap',
    inputSchema: {
        properties: {
            kind: {type: 'string', enum: ['radio', 'multi_select', 'point']},
            group_id: GROUP_ID_SCHEMA,
        },
        required: ['kind', 'group_id'],
    },
    handler: async (input, ctx) => {
        const r = requireApi(ctx)
        if ('unavailable' in r) return r.unavailable
        const {api} = r
        switch (input.kind) {
            case 'radio': {
                const selected = api.getRadioSelection(input.group_id) ?? null
                return {
                    data: {group_id: input.group_id, selected},
                    display: `radio "${input.group_id}" = ${selected ?? '(none)'}`,
                }
            }
            case 'multi_select': {
                const selected = api.getMultiSelectSelections(input.group_id)
                return {
                    data: {group_id: input.group_id, selected},
                    display: `multi-select "${input.group_id}" = [${selected.join(', ')}]`,
                }
            }
            case 'point': {
                const pool = api.getPointPool(input.group_id)
                const allocations = api.getPointAllocations(input.group_id)
                return {
                    data: {group_id: input.group_id, pool, allocations},
                    display: `points "${input.group_id}": ${pool.used}/${pool.total} used`,
                }
            }
        }
    },
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

export const CRAFT_INTERACTION_TOOLS: Tool[] = [
    registerRadioGroup,
    registerMultiSelectGroup,
    registerPointAllocator,
    registerPercentAllocator,
    registerNumberSlider,
    clearInteraction,
    readSelection,
] as Tool[]
