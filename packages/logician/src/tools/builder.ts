/**
 * Builder tools — let the LLM construct block-shaped models in a workbook
 * from a natural-language description.
 *
 * Surface (10 tools, block-only — no raw (sheet,row,col) writes):
 *   Structure  : create_sheet, create_block, add_block_rows, delete_block_rows
 *   Rules      : set_field_rule, define_enum_set
 *   Reflection : list_blocks, describe_block, eval_formula
 *   Safety     : checkpoint / restore       (one tool, two ops)
 *
 * Handlers below are intentionally thin — they describe the contract.
 * Real implementations will dispatch to the workbook client + block manager.
 */

import {
    BindFormSchemaBuilder,
    BlockInputBuilder,
    CreateBlockBuilder,
    CreateSheetBuilder,
    DeleteRowsBuilder,
    DeleteRowsInBlockBuilder,
    InsertRowsBuilder,
    InsertRowsInBlockBuilder,
    UpsertFieldFormulasBuilder,
    acquireCraftCalc,
    isErrorMessage,
} from 'logisheets-web'
import type {CraftCalc, Value} from 'logisheets-web'
import type {
    ActionEffect,
    Client,
    EditPayload,
    Transaction,
} from 'logisheets-web'
import type {JSONSchema, Tool, ToolContext, ToolResult} from '../tool'

/** Narrow the workbook client to the concrete `Client` from logisheets-web.
 *  `ctx.workbook: WorkbookClient` is already a type alias for `Client` —
 *  this helper just removes the unsafe cast at every call site. */
function asClient(ctx: ToolContext): Client {
    return ctx.workbook as Client
}

/** Throw a typed error if a transaction's status came back as 'err'. */
function ensureOk(effect: ActionEffect, label: string): void {
    if (effect.status.type === 'err') {
        throw new Error(`${label}: status code ${effect.status.value}`)
    }
}

/** Coerce arbitrary JSON values into the string form BlockInput expects.
 *  Numbers / booleans / null are stringified; strings pass through. */
function stringifyForBlockInput(v: unknown): string {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return JSON.stringify(v)
}

/** Submit a single transaction; throw on 'err' or RPC failure. Wraps the
 *  `handleTransaction` RPC so callers focus on building payloads. */
async function commitTransaction(
    client: Client,
    payloads: EditPayload[],
    label: string,
    undoable = true
): Promise<void> {
    const tx: Transaction = {payloads, undoable, temp: false}
    const result = await client.handleTransaction({transaction: tx})
    if (isErrorMessage(result)) {
        throw new Error(`${label}: ${result.msg}`)
    }
    ensureOk(result, label)
}

// ---------------------------------------------------------------------------
// Shared schema fragments
// ---------------------------------------------------------------------------

const FIELD_TYPE_ENUM = [
    'string',
    'number',
    'boolean',
    'enum',
    'date',
    'datetime',
] as const

const FIELD_SCHEMA: JSONSchema = {
    type: 'object',
    properties: {
        name: {type: 'string', description: 'Field (column) name.'},
        field_type: {
            type: 'string',
            enum: [...FIELD_TYPE_ENUM],
            description:
                "Optional. Set it explicitly when the field's MEANING implies a type — e.g. a column called deadline / due date / birthday / created_at is 'date' (or 'datetime' if it carries a time). 'date'/'datetime' render with a calendar-style format (override via num_fmt). If omitted, the type is inferred from initial_rows values: booleans → boolean, numerics → number, date-like strings → date, low-cardinality categorical strings → an auto-created enum set, otherwise string.",
        },
        num_fmt: {
            type: 'string',
            description:
                'Excel number format, e.g. "0", "0.00", "0.00%", "#,##0". Only meaningful when field_type=number.',
        },
        enum_id: {
            type: 'string',
            description:
                'Enum set id. Required when field_type=enum. Must match an id passed to define_enum_set.',
        },
        user_editable: {
            type: 'boolean',
            description:
                'Whether the user can edit this cell directly. Use editability formula via set_field_rule for conditional editing.',
            default: false,
        },
    },
    required: ['name'],
}

const ROW_SCHEMA: JSONSchema = {
    type: 'object',
    properties: {
        key: {
            type: 'string',
            description:
                'Row key (first column). Used as the row selector elsewhere. Must be unique within the block.',
        },
        values: {
            type: 'object',
            description:
                'Optional initial values keyed by field name. Fields with a value_formula should be omitted. For date/datetime fields, supply ISO strings ("YYYY-MM-DD" or "YYYY-MM-DDTHH:MM") — Watson converts them to the numeric form cells store.',
        },
    },
    required: ['key'],
}

// ---------------------------------------------------------------------------
// Field-type inference
//
// When create_block declares a field without an explicit `field_type`, we
// infer it from the field's initial-row values. This keeps blocks honest
// about their data shape (number formatting, boolean checkboxes, enum
// dropdowns, date formats) without the LLM having to classify every column
// by hand. Explicitly-typed fields are always respected as-is.
// ---------------------------------------------------------------------------

function isBoolLike(v: unknown): boolean {
    if (typeof v === 'boolean') return true
    if (typeof v !== 'string') return false
    const s = v.trim().toLowerCase()
    return s === 'true' || s === 'false'
}

function isNumberLike(v: unknown): boolean {
    if (typeof v === 'number') return Number.isFinite(v)
    if (typeof v !== 'string') return false
    const s = v.trim()
    if (s === '') return false
    // Tolerate thousands separators / a single percent or currency sign.
    const cleaned = s.replace(/[,$%]/g, '')
    return cleaned !== '' && Number.isFinite(Number(cleaned))
}

/** Detect a uniform date format across the column. Returns the matching
 *  Excel number-format string, or null when the values aren't all dates.
 *  Dates are stored as `number` fields (the engine has no distinct date
 *  type) carrying a date formatter. */
function detectDateFormat(values: readonly unknown[]): string | null {
    const patterns: Array<{re: RegExp; fmt: string}> = [
        {re: /^\d{4}-\d{1,2}-\d{1,2}$/, fmt: 'yyyy-mm-dd'},
        {re: /^\d{4}\/\d{1,2}\/\d{1,2}$/, fmt: 'yyyy/mm/dd'},
        {re: /^\d{1,2}\/\d{1,2}\/\d{4}$/, fmt: 'mm/dd/yyyy'},
        {re: /^\d{4}-\d{1,2}-\d{1,2}[ T]\d{1,2}:\d{2}/, fmt: 'yyyy-mm-dd hh:mm'},
    ]
    for (const {re, fmt} of patterns) {
        if (
            values.every((v) => typeof v === 'string' && re.test(v.trim()))
        ) {
            return fmt
        }
    }
    return null
}

/** Heuristic: a low-cardinality categorical string column reads as an enum.
 *  Needs enough rows to be confident, few distinct values, and meaningful
 *  repetition (distinct ≤ half the rows). */
function looksLikeEnum(distinct: readonly string[], total: number): boolean {
    return (
        total >= 4 &&
        distinct.length >= 2 &&
        distinct.length <= 8 &&
        distinct.length <= total / 2
    )
}

/** Convert an ISO-ish date/datetime string to an Excel serial number (the
 *  numeric form block cells store for dates). Returns null when the value
 *  can't be parsed, so the caller can fall back to writing it verbatim.
 *
 *  Excel's 1900 date system: serial 1 = 1900-01-01; 25569 is the day count
 *  from the serial epoch (1899-12-30) to the Unix epoch (1970-01-01).
 *  Components are read as UTC so the serial is timezone-independent. */
function toExcelSerial(value: unknown, withTime: boolean): number | null {
    if (typeof value === 'number') return value // already numeric
    if (typeof value !== 'string') return null
    const s = value.trim()
    const m = s.match(
        /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    )
    let y: number, mo: number, d: number, hh = 0, mm = 0, ss = 0
    if (m) {
        y = +m[1]
        mo = +m[2]
        d = +m[3]
        hh = m[4] ? +m[4] : 0
        mm = m[5] ? +m[5] : 0
        ss = m[6] ? +m[6] : 0
    } else {
        // US-style M/D/Y as a fallback.
        const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
        if (!us) return null
        mo = +us[1]
        d = +us[2]
        y = +us[3]
    }
    const ms = Date.UTC(y, mo - 1, d, hh, mm, ss)
    if (Number.isNaN(ms)) return null
    const serial = ms / 86400000 + 25569
    return withTime ? serial : Math.floor(serial)
}

function autoEnumId(blockName: string, fieldName: string): string {
    const slug = (s: string) =>
        s
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
    return `${slug(blockName)}_${slug(fieldName)}_auto`
}

// ---------------------------------------------------------------------------
// 1. create_sheet
// ---------------------------------------------------------------------------

export const createSheet: Tool<{name: string}, {sheet_idx: number}> = {
    namespace: 'build',
    name: 'create_sheet',
    description:
        'Create a new sheet in the workbook. Returns the new sheet index. Idempotent: if a sheet with the same name exists, returns its index without creating a duplicate. Typically the agent does NOT call this directly — `create_block` will call it implicitly when the target sheet is missing. Use it only when you want an empty named sheet up front.',
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            name: {type: 'string', description: 'Sheet name.'},
        },
        required: ['name'],
    },
    handler: async ({name}, ctx): Promise<ToolResult<{sheet_idx: number}>> => {
        const client = asClient(ctx)

        // Idempotent: if a sheet with this name already exists, return
        // its index instead of creating a duplicate.
        const beforeRes = await client.getAllSheetInfo()
        if (isErrorMessage(beforeRes)) {
            throw new Error(`getAllSheetInfo failed: ${beforeRes.msg}`)
        }
        const before = beforeRes
        const existing = before.findIndex((s) => s.name === name)
        if (existing >= 0) {
            return {
                data: {sheet_idx: existing},
                display: `Sheet "${name}" already exists at idx ${existing}.`,
            }
        }

        // Append the new sheet at the end (idx = current count).
        const newIdx = before.length
        await commitTransaction(
            client,
            [
                {
                    type: 'createSheet',
                    value: new CreateSheetBuilder()
                        .idx(newIdx)
                        .newName(name)
                        .build(),
                },
            ],
            `createSheet("${name}")`
        )
        return {
            data: {sheet_idx: newIdx},
            display: `Created sheet "${name}" at idx ${newIdx}.`,
        }
    },
}

// ---------------------------------------------------------------------------
// 2. create_block
// ---------------------------------------------------------------------------

interface CreateBlockInput {
    sheet: string
    name: string
    position: {row: number; col: number}
    fields: ReadonlyArray<{
        name: string
        field_type?: (typeof FIELD_TYPE_ENUM)[number]
        num_fmt?: string
        enum_id?: string
        user_editable?: boolean
    }>
    initial_rows?: ReadonlyArray<{
        key: string
        values?: Record<string, unknown>
    }>
}

/** A field with its `field_type` resolved (either explicit or inferred). */
interface ResolvedField {
    name: string
    field_type: (typeof FIELD_TYPE_ENUM)[number]
    num_fmt?: string
    enum_id?: string
    user_editable?: boolean
}

export const createBlock: Tool<CreateBlockInput, {block_id: number}> = {
    namespace: 'build',
    name: 'create_block',
    description: [
        'Create a structured block (table) on a sheet. fields[0] is the row-key column (always read-only). Block ref name (`name`) is used as the first arg to BLOCKREF/BLOCKREFS in formulas.',
        '',
        'Field types supported:',
        "  - 'string' / 'number'   — plain text/numeric cells.",
        "  - 'boolean'             — cell stores 0/1 or TRUE/FALSE; UI renders ✅/❌ if host has the widget set.",
        "  - 'enum' (+ enum_id)    — cell stores variant id; UI renders dropdown if host has the widget set. Watson auto-injects a variant-whitelist validation formula on the field so out-of-set writes light up as warnings even without widget rendering. Requires a prior define_enum_set call with matching id.",
        '',
        'Rules (value_formula / validation / editability) are set separately via set_field_rule — this call only declares structure + initial rows. Auto-creates the target sheet if missing.',
    ].join('\n'),
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            sheet: {type: 'string', description: 'Target sheet name.'},
            name: {
                type: 'string',
                description:
                    'Block ref name. Used as the first arg to BLOCKREF/BLOCKREFS in formulas. Must be unique within the workbook.',
            },
            position: {
                type: 'object',
                properties: {
                    row: {type: 'integer', minimum: 0},
                    col: {type: 'integer', minimum: 0},
                },
                required: ['row', 'col'],
                description: 'Top-left cell of the block (0-indexed).',
            },
            fields: {
                type: 'array',
                minItems: 1,
                items: FIELD_SCHEMA,
                description:
                    'Column definitions in order. fields[0] is the row-key column.',
            },
            initial_rows: {
                type: 'array',
                items: ROW_SCHEMA,
                description: 'Optional initial rows.',
            },
        },
        required: ['sheet', 'name', 'position', 'fields'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)

        // Resolve each field's type: explicit wins; otherwise infer from the
        // column's initial-row values. Inferred enums auto-create a backing
        // set (registered with the host blockManager when present, always
        // cached locally) so the existing enum gate below picks them up.
        const colValues = (fieldName: string): unknown[] =>
            (input.initial_rows ?? [])
                .map((r) => r.values?.[fieldName])
                .filter((v) => v !== undefined && v !== null && v !== '')

        const resolvedFields: ResolvedField[] = input.fields.map((f, i) => {
            if (f.field_type) return {...f, field_type: f.field_type}
            // The key column (fields[0]) is a row identifier, not data.
            if (i === 0) return {...f, field_type: 'string'}
            const vals = colValues(f.name)
            if (vals.length === 0) return {...f, field_type: 'string'}
            if (vals.every(isBoolLike)) return {...f, field_type: 'boolean'}
            if (vals.every(isNumberLike))
                return {...f, field_type: 'number', num_fmt: f.num_fmt}
            const dateFmt = detectDateFormat(vals)
            if (dateFmt) return {...f, field_type: 'date', num_fmt: dateFmt}
            const distinct = [...new Set(vals.map((v) => String(v)))]
            if (looksLikeEnum(distinct, vals.length)) {
                const enumId = autoEnumId(input.name, f.name)
                const variants = distinct.map((v, vi) => ({
                    id: v,
                    value: v,
                    color: _ENUM_PALETTE[vi % _ENUM_PALETTE.length],
                }))
                const bm = tryGetBlockManager()
                if (bm) bm.enumSetManager.set(enumId, enumId, variants)
                _enumSetCache.set(enumId, {id: enumId, name: enumId, variants})
                return {...f, field_type: 'enum', enum_id: enumId}
            }
            return {...f, field_type: 'string'}
        })

        // Resolve enum_id → variant ids per enum field. Pull from
        // _enumSetCache (filled by define_enum_set, or by inference above).
        // Out-of-cache enum_ids fail fast — the LLM should have defined the
        // set first.
        const enumVariantsByField: Map<number, readonly string[]> = new Map()
        for (let i = 0; i < resolvedFields.length; i++) {
            const f = resolvedFields[i]
            if (f.field_type !== 'enum') continue
            if (!f.enum_id) {
                throw new Error(
                    `field "${f.name}" has field_type='enum' but no enum_id — call define_enum_set first and pass its id`
                )
            }
            const set = _enumSetCache.get(f.enum_id)
            if (!set) {
                throw new Error(
                    `enum_id "${f.enum_id}" not defined — call define_enum_set("${f.enum_id}", ...) first`
                )
            }
            enumVariantsByField.set(
                i,
                set.variants.map((v) => v.id)
            )
        }

        // 1. Resolve target sheet (auto-create if missing).
        const sheetInfosRes = await client.getAllSheetInfo()
        if (isErrorMessage(sheetInfosRes)) {
            throw new Error(`getAllSheetInfo failed: ${sheetInfosRes.msg}`)
        }
        const sheetInfos = sheetInfosRes
        let sheetIdx = sheetInfos.findIndex((s) => s.name === input.sheet)
        if (sheetIdx < 0) {
            sheetIdx = sheetInfos.length
            await commitTransaction(
                client,
                [
                    {
                        type: 'createSheet',
                        value: new CreateSheetBuilder()
                            .idx(sheetIdx)
                            .newName(input.sheet)
                            .build(),
                    },
                ],
                `auto-create sheet "${input.sheet}"`
            )
        }

        // 2. Mint a fresh block id.
        const idRes = await client.getAvailableBlockId({sheetIdx})
        if (isErrorMessage(idRes)) {
            throw new Error(`getAvailableBlockId failed: ${idRes.msg}`)
        }
        const blockId = idRes

        // 2b. Register each field with the host's FieldManager when
        //     available. This lets block-interface widgets (✅/❌ for
        //     boolean, dropdown for enum) resolve renderId → FieldInfo
        //     and render the right control. The returned `info.id` is
        //     the canonical renderId we then pass to BindFormSchema.
        //
        //     Headless hosts (no globalThis.blockManager) skip this and
        //     fall back to Watson-minted opaque renderIds — cells then
        //     render as raw values (still functionally correct, just
        //     no widget chrome).
        //
        //     fields[0] is the key column; we always declare it static-
        //     uneditable (matches factory-simulator / engine's "keys are
        //     row identifiers, never user data" convention).
        const bm = tryGetBlockManager()
        const sheetIdRes = await client.getSheetId({sheetIdx})
        if (isErrorMessage(sheetIdRes)) {
            throw new Error(`getSheetId failed: ${sheetIdRes.msg}`)
        }
        const sheetId = sheetIdRes

        const renderIds: string[] = []
        for (let i = 0; i < resolvedFields.length; i++) {
            const f = resolvedFields[i]
            if (bm) {
                const typeSpec = buildFieldTypeSpec(
                    f,
                    enumVariantsByField.get(i)
                )
                const fi = bm.fieldManager.create(sheetId, blockId, {
                    name: f.name,
                    type: typeSpec,
                    required: false,
                    unique: false,
                    userEditable: i === 0 ? false : f.user_editable ?? true,
                })
                renderIds.push(fi.id)
            } else {
                renderIds.push(`${input.name}__f${i}`)
            }
        }

        // 3. Compose the payload sequence:
        //      CreateBlock
        //      BlockInput(keys)             ← keys before BindFormSchema so
        //                                     #KEY substitutions resolve to
        //                                     real values at template install
        //      BindFormSchema               ← declares schema; engine auto-
        //                                     installs shadows from declared
        //                                     templates (none yet — empty
        //                                     vecs preserve nothing here)
        //      BlockInput(non-key values)   ← AFTER BindFormSchema; templated
        //                                     cells reject these by design,
        //                                     non-templated commit normally
        const fieldNames = resolvedFields.map((f) => f.name)
        const initialRows = input.initial_rows ?? []
        const rowCnt = Math.max(1, initialRows.length) // engine requires ≥1 row
        const colCnt = resolvedFields.length

        const payloads: EditPayload[] = []

        payloads.push({
            type: 'createBlock',
            value: new CreateBlockBuilder()
                .sheetIdx(sheetIdx)
                .id(blockId)
                .masterRow(input.position.row)
                .masterCol(input.position.col)
                .rowCnt(rowCnt)
                .colCnt(colCnt)
                .build(),
        })

        for (let i = 0; i < initialRows.length; i++) {
            payloads.push({
                type: 'blockInput',
                value: new BlockInputBuilder()
                    .sheetIdx(sheetIdx)
                    .blockId(blockId)
                    .row(i)
                    .col(0)
                    .input(initialRows[i].key)
                    .build(),
            })
        }

        // Auto-inject a variant-whitelist validation formula for each
        // enum field. Engine-managed via Phase 1+2: storing this in
        // BindFormSchema.validationFormulas means the shadow is
        // installed on every row automatically (and on every new row
        // from InsertRowsInBlock).
        const validationFormulas = resolvedFields.map((_, i) => {
            const variants = enumVariantsByField.get(i)
            if (!variants) return ''
            return enumWhitelistFormula(variants)
        })

        payloads.push({
            type: 'bindFormSchema',
            value: new BindFormSchemaBuilder()
                .refName(input.name)
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .fieldFrom(0)
                .keyIdx(0)
                .fields(fieldNames)
                .renderIds(renderIds)
                // No value templates at create time; rules are layered
                // via set_field_rule. Empty strings normalize to None
                // engine-side (matches the TS binding's `readonly
                // string[]` shape).
                .fieldFormulas(fieldNames.map(() => ''))
                .validationFormulas(validationFormulas)
                .editabilityFormulas([])
                .row(true)
                .build(),
        })

        for (let i = 0; i < initialRows.length; i++) {
            const values = initialRows[i].values ?? {}
            for (const [fieldName, value] of Object.entries(values)) {
                const colIdx = fieldNames.indexOf(fieldName)
                if (colIdx < 0) {
                    throw new Error(
                        `initial_rows[${i}].values references unknown field '${fieldName}'`
                    )
                }
                if (colIdx === 0) continue // key already written above
                // Date/datetime fields store an Excel serial number, not the
                // raw string — convert here so the formatter renders a real
                // date instead of leaving an unparsed string in the cell.
                const ft = resolvedFields[colIdx]?.field_type
                let inputStr: string
                if (ft === 'date' || ft === 'datetime') {
                    const serial = toExcelSerial(value, ft === 'datetime')
                    inputStr =
                        serial !== null
                            ? String(serial)
                            : stringifyForBlockInput(value)
                } else {
                    inputStr = stringifyForBlockInput(value)
                }
                payloads.push({
                    type: 'blockInput',
                    value: new BlockInputBuilder()
                        .sheetIdx(sheetIdx)
                        .blockId(blockId)
                        .row(i)
                        .col(colIdx)
                        .input(inputStr)
                        .build(),
                })
            }
        }

        await commitTransaction(
            client,
            payloads,
            `create_block("${input.name}")`
        )

        // Stamp the schema's refName onto every FieldInfo we just
        // created. FieldManager doesn't know the refName at create-time
        // — the host learns it from BindFormSchema, which commits as
        // part of the tx above. Without this stamp the block-composer
        // and similar UI lose the reverse refName→fields lookup.
        if (bm) {
            bm.fieldManager.setBlockRefName(sheetId, blockId, input.name)
        }

        const widgetNote = bm ? 'widget rendering on' : 'no widget host'
        return {
            data: {block_id: blockId},
            display: `Created block "${input.name}" (id=${blockId}) at sheet "${input.sheet}" pos (${input.position.row},${input.position.col}) — ${input.fields.length} field(s) × ${rowCnt} row(s) (${widgetNote}).`,
        }
    },
}

/** Map Watson's flat field input to the `FieldTypeEnum` shape the host
 *  FieldManager expects. We only emit the variants we currently
 *  support; richer types (datetime, fieldRef, image, multiSelect...)
 *  are out of scope until Watson exposes their UX. */
function buildFieldTypeSpec(
    f: {
        name: string
        field_type: (typeof FIELD_TYPE_ENUM)[number]
        num_fmt?: string
        enum_id?: string
    },
    enumVariants: readonly string[] | undefined
): FieldTypeSpec {
    switch (f.field_type) {
        case 'string':
            return {type: 'string', validation: ''}
        case 'number':
            return {
                type: 'number',
                validation: '',
                formatter: f.num_fmt ?? '',
            }
        // The engine has no distinct date type — dates are numbers carrying
        // a date formatter. Honor an explicit num_fmt, else a sensible default.
        case 'date':
            return {
                type: 'number',
                validation: '',
                formatter: f.num_fmt ?? 'yyyy-mm-dd',
            }
        case 'datetime':
            return {
                type: 'number',
                validation: '',
                formatter: f.num_fmt ?? 'yyyy-mm-dd hh:mm',
            }
        case 'boolean':
            return {type: 'boolean'}
        case 'enum':
            // enumVariants check happened at the gate above; treat
            // missing here as a programming error rather than a user
            // error.
            if (!f.enum_id || !enumVariants) {
                throw new Error(
                    `internal: missing enum_id/variants for enum field "${f.name}"`
                )
            }
            return {type: 'enum', id: f.enum_id}
    }
}

// ---------------------------------------------------------------------------
// 3. add_block_rows
// ---------------------------------------------------------------------------

interface AddBlockRowsInput {
    block: string
    rows: ReadonlyArray<{key: string; values?: Record<string, unknown>}>
}

export const addBlockRows: Tool<AddBlockRowsInput, {added: number}> = {
    namespace: 'build',
    name: 'add_block_rows',
    description:
        "Append rows to an existing block. Each row needs a key; values is an object keyed by field name. Fields with a value_formula are auto-materialized by the engine — don't pass them in values. Validation/editability shadows for the new rows are auto-installed by the engine at InsertRowsInBlock time, so no follow-up is needed. Also inserts the matching sheet rows (one block per sheet-row assumption — extends the sheet so downstream rows shift down).",
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            block: {type: 'string', description: 'Block ref name.'},
            rows: {type: 'array', items: ROW_SCHEMA, minItems: 1},
        },
        required: ['block', 'rows'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)

        // 1. Resolve block ref name → (sheetIdx, blockId, current rowCnt,
        //    field name order in schema-declared order).
        const all = await client.getAllBlocks({})
        if (isErrorMessage(all)) {
            throw new Error(`getAllBlocks failed: ${all.msg}`)
        }
        const block = all.find((b) => b.schema?.name === input.block)
        if (!block) {
            throw new Error(`No block with ref name "${input.block}"`)
        }
        const schema = block.schema
        if (!schema) {
            throw new Error(
                `Block "${input.block}" has no schema — can't determine field order`
            )
        }
        const sheetIdx = block.sheetIdx
        const blockId = block.blockId
        const blockStart = block.rowCnt // append after the last existing block row
        // Sheet-absolute row where new rows physically land. Under our
        // "one block per row" assumption the rows immediately after the
        // block are free to shift down without colliding with another
        // block; if a future relaxation allows side-by-side blocks the
        // caller would need to pick a different insert site.
        const sheetStart = block.rowStart + block.rowCnt
        const fieldNames = [...schema.fields]
            .sort((a, b) => a.idx - b.idx)
            .map((f) => f.field)

        // 2. Compose payloads:
        //      InsertRows(sheetStart, cnt)     ← physical sheet rows so
        //                                         downstream content shifts
        //                                         down and doesn't overlap
        //                                         the grown block range
        //      InsertRowsInBlock(start, cnt)   ← engine extends block rows
        //                                         + auto-materializes
        //                                         value_formula + auto-
        //                                         installs validation /
        //                                         editability shadows
        //      BlockInput(key, ...values)      ← one per (row × field with
        //                                         non-null value), key always
        //                                         goes in col 0
        const cnt = input.rows.length
        const payloads: EditPayload[] = []
        payloads.push({
            type: 'insertRows',
            value: new InsertRowsBuilder()
                .sheetIdx(sheetIdx)
                .start(sheetStart)
                .count(cnt)
                .build(),
        })
        payloads.push({
            type: 'insertRowsInBlock',
            value: new InsertRowsInBlockBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .start(blockStart)
                .cnt(cnt)
                .build(),
        })

        for (let i = 0; i < input.rows.length; i++) {
            const r = input.rows[i]
            const row = blockStart + i
            // Key always goes to col 0.
            payloads.push({
                type: 'blockInput',
                value: new BlockInputBuilder()
                    .sheetIdx(sheetIdx)
                    .blockId(blockId)
                    .row(row)
                    .col(0)
                    .input(r.key)
                    .build(),
            })
            const values = r.values ?? {}
            for (const [fieldName, value] of Object.entries(values)) {
                const colIdx = fieldNames.indexOf(fieldName)
                if (colIdx < 0) {
                    throw new Error(
                        `rows[${i}].values references unknown field '${fieldName}' for block "${input.block}"`
                    )
                }
                if (colIdx === 0) continue // key already written
                payloads.push({
                    type: 'blockInput',
                    value: new BlockInputBuilder()
                        .sheetIdx(sheetIdx)
                        .blockId(blockId)
                        .row(row)
                        .col(colIdx)
                        .input(stringifyForBlockInput(value))
                        .build(),
                })
            }
        }

        await commitTransaction(
            client,
            payloads,
            `add_block_rows("${input.block}")`
        )

        return {
            data: {added: cnt},
            display: `Appended ${cnt} row(s) to "${input.block}" (block row ${blockStart}, sheet row ${sheetStart}).`,
        }
    },
}

// ---------------------------------------------------------------------------
// 4. delete_block_rows
// ---------------------------------------------------------------------------

interface DeleteBlockRowsInput {
    block: string
    keys: ReadonlyArray<string>
}

export const deleteBlockRows: Tool<DeleteBlockRowsInput, {removed: number}> = {
    namespace: 'build',
    name: 'delete_block_rows',
    description:
        "Delete rows from a block by their key. Missing keys are silently ignored. Also deletes the matching sheet rows (one block per sheet-row assumption). If you try to delete every row, the last one is kept and its cells are cleared instead — the engine doesn't allow rowCnt=0 blocks.",
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            block: {type: 'string'},
            keys: {type: 'array', items: {type: 'string'}, minItems: 1},
        },
        required: ['block', 'keys'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)

        // 1. Resolve block + schema (need keys → block-row index map +
        //    field count for the "clear all cells" sentinel branch).
        const all = await client.getAllBlocks({})
        if (isErrorMessage(all)) {
            throw new Error(`getAllBlocks failed: ${all.msg}`)
        }
        const block = all.find((b) => b.schema?.name === input.block)
        if (!block) {
            throw new Error(`No block with ref name "${input.block}"`)
        }
        const schema = block.schema
        if (!schema) {
            throw new Error(
                `Block "${input.block}" has no schema — can't locate rows by key`
            )
        }
        const sheetIdx = block.sheetIdx
        const blockId = block.blockId
        const blockRowStart = block.rowStart
        const totalRows = block.rowCnt
        const colCnt = schema.fields.length

        // Map row-key → block-relative row index.
        const keyToRow = new Map<string, number>()
        for (const k of schema.keys) keyToRow.set(k.key, k.idx)

        // Resolve requested keys to block-row indices. Drop unknowns
        // silently (per description: "missing keys are ignored").
        const targetRows = input.keys
            .map((k) => keyToRow.get(k))
            .filter((r): r is number => r !== undefined)

        if (targetRows.length === 0) {
            return {
                data: {removed: 0},
                display: `No matching rows in "${input.block}".`,
            }
        }

        // Engine rejects rowCnt=0 blocks: if the caller asked to delete
        // EVERY row, keep one row as a sentinel and clear its cells
        // instead. Pick the lowest target index to clear; remove the
        // rest normally.
        const willEmpty = targetRows.length >= totalRows
        const uniqueSortedDesc = Array.from(new Set(targetRows)).sort(
            (a, b) => b - a
        )

        const payloads: EditPayload[] = []

        if (willEmpty) {
            // Delete all but the first remaining row, then blank that one.
            const keepBlockRow = Math.min(...targetRows)
            const toRemove = uniqueSortedDesc.filter((r) => r !== keepBlockRow)
            // Delete from highest row downward so each delete's start
            // index stays valid relative to the still-existing rows.
            for (const r of toRemove) {
                payloads.push({
                    type: 'deleteRowsInBlock',
                    value: new DeleteRowsInBlockBuilder()
                        .sheetIdx(sheetIdx)
                        .blockId(blockId)
                        .start(r)
                        .cnt(1)
                        .build(),
                })
                payloads.push({
                    type: 'deleteRows',
                    value: new DeleteRowsBuilder()
                        .sheetIdx(sheetIdx)
                        .start(blockRowStart + r)
                        .count(1)
                        .build(),
                })
            }
            // Clear remaining sentinel row (incl. key column — caller
            // asked to remove it after all, so leave nothing behind).
            for (let c = 0; c < colCnt; c++) {
                payloads.push({
                    type: 'blockInput',
                    value: new BlockInputBuilder()
                        .sheetIdx(sheetIdx)
                        .blockId(blockId)
                        .row(keepBlockRow)
                        .col(c)
                        .input('')
                        .build(),
                })
            }
        } else {
            // Normal path: delete each requested row. Walk descending
            // so the row numbers we already chose stay valid.
            for (const r of uniqueSortedDesc) {
                payloads.push({
                    type: 'deleteRowsInBlock',
                    value: new DeleteRowsInBlockBuilder()
                        .sheetIdx(sheetIdx)
                        .blockId(blockId)
                        .start(r)
                        .cnt(1)
                        .build(),
                })
                payloads.push({
                    type: 'deleteRows',
                    value: new DeleteRowsBuilder()
                        .sheetIdx(sheetIdx)
                        .start(blockRowStart + r)
                        .count(1)
                        .build(),
                })
            }
        }

        await commitTransaction(
            client,
            payloads,
            `delete_block_rows("${input.block}")`
        )

        return {
            data: {removed: targetRows.length},
            display: willEmpty
                ? `Cleared "${input.block}" — removed ${
                      targetRows.length - 1
                  } row(s) and blanked the remaining sentinel row.`
                : `Deleted ${uniqueSortedDesc.length} row(s) from "${input.block}".`,
        }
    },
}

// ---------------------------------------------------------------------------
// 5. set_field_rule
// ---------------------------------------------------------------------------

interface SetFieldRuleInput {
    block: string
    field: string
    value_formula?: string | null
    validation?: string | null
    editability?: string | null
}

export const setFieldRule: Tool<SetFieldRuleInput, {applied: string[]}> = {
    namespace: 'build',
    name: 'set_field_rule',
    description: [
        'Attach declarative rules to a field. All three rule kinds (value_formula, validation, editability) are optional — pass only the ones you want to change. Omit a kind entirely to leave it untouched on this field; pass `null` to explicitly clear an existing rule.',
        '',
        'Placeholders supported in formulas:',
        '  #FIELD("name") — reference to the same row\'s cell in field "name"',
        "  #KEY           — the row's key value (quoted as a string literal)",
        '  #PLACEHOLDER   — reference to the cell itself (validation/editability only)',
        '',
        'Engine behaviour after this call:',
        "  - value_formula  → cells in the field become engine-computed (no direct writes). Every row's formula is re-materialized.",
        '  - validation     → a `ShadowKind::Validation` shadow is auto-installed on every row; warning markers refresh.',
        '  - editability    → a `ShadowKind::UserEditable` shadow is auto-installed on every row; the host permission patch reads it to gate writes.',
        '',
        'Leading "=" on the formula body is optional; omit or include either way.',
    ].join('\n'),
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            block: {type: 'string'},
            field: {type: 'string'},
            value_formula: {
                type: ['string', 'null'],
                description:
                    'Formula template, e.g. "=#FIELD(\\"qty\\")*#FIELD(\\"price\\")". Pass null to clear; omit to leave existing untouched.',
            },
            validation: {
                type: ['string', 'null'],
                description:
                    'Boolean formula, e.g. "#PLACEHOLDER>=0". Pass null to clear; omit to leave existing untouched.',
            },
            editability: {
                type: ['string', 'null'],
                description:
                    'Boolean formula, e.g. "=#FIELD(\\"status\\")<>\\"locked\\"". Pass null to clear; omit to leave existing untouched.',
            },
        },
        required: ['block', 'field'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)

        // Reject the no-op case so callers don't accidentally hit an
        // empty transaction; surfacing "you didn't actually pass any
        // rule" is friendlier than a silent OK.
        const touched: string[] = []
        if (input.value_formula !== undefined) touched.push('value_formula')
        if (input.validation !== undefined) touched.push('validation')
        if (input.editability !== undefined) touched.push('editability')
        if (touched.length === 0) {
            throw new Error(
                'set_field_rule: pass at least one of value_formula, validation, editability'
            )
        }

        // 1. Resolve block + schema, and remember the schema's field
        //    ORDER (positional — same order as the original
        //    BindFormSchema call; UpsertFieldFormulas indexes by this).
        const all = await client.getAllBlocks({})
        if (isErrorMessage(all)) {
            throw new Error(`getAllBlocks failed: ${all.msg}`)
        }
        const block = all.find((b) => b.schema?.name === input.block)
        if (!block) {
            throw new Error(`No block with ref name "${input.block}"`)
        }
        const schema = block.schema
        if (!schema) {
            throw new Error(
                `Block "${input.block}" has no schema — bind it first via create_block`
            )
        }
        const fieldPos = schema.fields.findIndex((f) => f.field === input.field)
        if (fieldPos < 0) {
            throw new Error(
                `No field named "${input.field}" in block "${input.block}"`
            )
        }

        // 2. For each rule kind the caller touched, build a full-length
        //    array (one entry per field) keeping every OTHER field's
        //    existing template and updating just this one position.
        //    UpsertFieldFormulas semantics: empty vec = "leave that rule
        //    kind alone for ALL fields"; non-empty vec = "replace all
        //    per-field values for that kind".
        type FieldEntry = (typeof schema.fields)[number]
        const fieldEntries: readonly FieldEntry[] = schema.fields
        const buildVec = (
            updated: string | null,
            existing: (f: FieldEntry) => string | undefined
        ): readonly string[] =>
            fieldEntries.map((f, i) =>
                i === fieldPos
                    ? updated === null
                        ? ''
                        : normalizeFormula(updated)
                    : existing(f) ?? ''
            )

        const fieldFormulas =
            input.value_formula === undefined
                ? []
                : buildVec(input.value_formula, (f) => f.valueFormula)
        const validationFormulas =
            input.validation === undefined
                ? []
                : buildVec(input.validation, (f) => f.validationFormula)
        const editabilityFormulas =
            input.editability === undefined
                ? []
                : buildVec(input.editability, (f) => f.editabilityFormula)

        const payloads: EditPayload[] = [
            {
                type: 'upsertFieldFormulas',
                value: new UpsertFieldFormulasBuilder()
                    .sheetIdx(block.sheetIdx)
                    .blockId(block.blockId)
                    .fieldFormulas(fieldFormulas)
                    .validationFormulas(validationFormulas)
                    .editabilityFormulas(editabilityFormulas)
                    .build(),
            },
        ]

        await commitTransaction(
            client,
            payloads,
            `set_field_rule("${input.block}", "${input.field}")`
        )

        return {
            data: {applied: touched},
            display: `Updated ${touched.join(' + ')} on ${input.block}.${
                input.field
            }.`,
        }
    },
}

/** Guard for the checkpoint ops that need a label; surface a clear
 *  error to the LLM rather than letting the RPC fail with a less
 *  contextual message. */
function requireLabel(input: {label?: string}, op: string): string {
    const label = input.label?.trim()
    if (!label) {
        throw new Error(`checkpoint: op="${op}" requires \`label\``)
    }
    return label
}

/** Strip optional leading `=` so formulas are stored without it; the
 *  engine accepts both shapes but the schema-internal representation
 *  is the body. */
function normalizeFormula(s: string): string {
    const t = s.trim()
    if (!t) return ''
    return t.startsWith('=') ? t.slice(1) : t
}

// ---------------------------------------------------------------------------
// 6. define_enum_set
// ---------------------------------------------------------------------------

interface EnumVariantInput {
    id: string
    label: string
    /** Hex color (#RRGGBB). Auto-assigned from a palette if omitted. */
    color?: string
}

interface DefineEnumSetInput {
    id: string
    name?: string
    description?: string
    variants: ReadonlyArray<EnumVariantInput>
}

interface DefineEnumSetOutput {
    enum_id: string
    variant_count: number
    /** echoed variant id list so AI's next call (e.g. create_block with
     *  field_type='enum') has the canonical id strings handy. */
    variant_ids: string[]
}

/** A small palette to auto-assign visually-distinct colors when callers
 *  don't pick. Repeats after N variants — acceptable for the LLM-driven
 *  flow where variant counts are typically small. */
const _ENUM_PALETTE = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#a855f7', // purple
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
]

/** Minimal interface the handler needs from the host's blockManager.
 *  We don't import EnumSetManager/FieldManager from logisheets-engine
 *  to keep the logician package free of UI-layer dependencies; host
 *  injection via `window.blockManager` is loose-typed by design. */
interface EnumSetManagerLike {
    set(
        id: string,
        name: string,
        variants: ReadonlyArray<{id: string; value: string; color: string}>,
        description?: string
    ): unknown
}

/** FieldTypeEnum mirror — kept structural so we don't depend on the
 *  engine's class but stay shape-compatible with what its widgets read.
 *  Only the variants Watson currently supports are listed. */
type FieldTypeSpec =
    | {type: 'string'; validation: string}
    | {type: 'number'; validation: string; formatter: string}
    | {type: 'boolean'}
    | {type: 'enum'; id: string}

interface FieldInfoCreate {
    name: string
    type: FieldTypeSpec
    description?: string
    required: boolean
    unique: boolean
    defaultValue?: string
    userEditable?: boolean
}

interface FieldManagerLike {
    create(
        sheetId: number,
        blockId: number,
        fieldData: FieldInfoCreate
    ): {id: string} & FieldInfoCreate
    setBlockRefName(sheetId: number, blockId: number, refName: string): void
}

interface BlockManagerLike {
    enumSetManager: EnumSetManagerLike
    fieldManager: FieldManagerLike
}

function tryGetBlockManager(): BlockManagerLike | null {
    const g = globalThis as unknown as {blockManager?: BlockManagerLike}
    return g.blockManager ?? null
}

/** Build a per-field validation_formula body that whitelists the given
 *  variant ids. Empty cells are allowed (UI lets the user clear the
 *  selection). Uses EXACT for case-sensitive match — variant ids in
 *  factory-simulator-style flows are stable ASCII strings, but the
 *  helper stays safe under CJK / mixed-case variants too. */
function enumWhitelistFormula(variantIds: readonly string[]): string {
    if (variantIds.length === 0) return ''
    const clauses = variantIds.map((v) => {
        // Excel string literals escape `"` as `""`.
        const escaped = v.replace(/"/g, '""')
        return `EXACT(#PLACEHOLDER,"${escaped}")`
    })
    // `=OR(#PLACEHOLDER="", EXACT(...), EXACT(...))`
    return `OR(#PLACEHOLDER="",${clauses.join(',')})`
}

export const defineEnumSet: Tool<DefineEnumSetInput, DefineEnumSetOutput> = {
    namespace: 'build',
    name: 'define_enum_set',
    description: [
        "Define or overwrite an enum set — a named list of allowed values for a field. After this call, declare a field with `field_type: 'enum'` and `enum_id: '<this set's id>'` (via create_block or set_field_rule) to use the set. Cells store the variant `id` (not the label); host UI renders a dropdown of labels.",
        '',
        'Tips for the LLM:',
        '  - Pick stable variant `id`s (snake_case, ASCII). They go into cells and persist.',
        '  - `label` is what humans see in the dropdown — can be any language.',
        '  - `color` is optional; a sensible palette is auto-assigned.',
        '',
        "If the host environment doesn't expose `blockManager` (headless / SDK mode), the set is still recorded in this Watson session so subsequent create_block / set_field_rule calls can reference it for validation — they just won't get the dropdown widget.",
    ].join('\n'),
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            id: {
                type: 'string',
                description:
                    'Set id (snake_case recommended). Stable across calls; overwrites an existing set with the same id.',
            },
            name: {
                type: 'string',
                description:
                    'Human-readable name shown in the composer / dropdown header. Defaults to the id.',
            },
            description: {
                type: 'string',
                description: 'Optional short description for the set.',
            },
            variants: {
                type: 'array',
                minItems: 1,
                items: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description:
                                'Variant id stored in cells. Must be unique within the set.',
                        },
                        label: {
                            type: 'string',
                            description: 'Display label.',
                        },
                        color: {
                            type: 'string',
                            description:
                                'Hex color (#RRGGBB). Auto-assigned if omitted.',
                        },
                    },
                    required: ['id', 'label'],
                },
            },
        },
        required: ['id', 'variants'],
    },
    handler: async (input, _ctx) => {
        // Validate variant uniqueness up front so the error message is
        // clear (the underlying EnumSetManager.set throws too, but with
        // less context).
        const seenIds = new Set<string>()
        const seenLabels = new Set<string>()
        for (const v of input.variants) {
            if (seenIds.has(v.id))
                throw new Error(`duplicate variant id "${v.id}"`)
            if (seenLabels.has(v.label))
                throw new Error(`duplicate variant label "${v.label}"`)
            seenIds.add(v.id)
            seenLabels.add(v.label)
        }

        // Fill in colors from the palette for any variant that omitted one.
        const variants = input.variants.map((v, i) => ({
            id: v.id,
            value: v.label,
            color: v.color ?? _ENUM_PALETTE[i % _ENUM_PALETTE.length],
        }))

        const setName = input.name ?? input.id

        // Register with the host blockManager if available. This makes
        // the dropdown widget show up on cells using this enum.
        // Headless hosts simply skip — the enum spec still helps the
        // LLM-side workflow (create_block will auto-inject a variant
        // whitelist validation_formula even without widget rendering).
        const bm = tryGetBlockManager()
        let bound = false
        if (bm) {
            bm.enumSetManager.set(
                input.id,
                setName,
                variants,
                input.description
            )
            bound = true
        }

        // Always cache locally — the create_block handler reads this map
        // to auto-inject a whitelist validation formula for enum fields,
        // regardless of whether the host registered the set or not.
        _enumSetCache.set(input.id, {
            id: input.id,
            name: setName,
            description: input.description,
            variants,
        })

        return {
            data: {
                enum_id: input.id,
                variant_count: variants.length,
                variant_ids: variants.map((v) => v.id),
            },
            display: bound
                ? `Defined enum set "${input.id}" with ${variants.length} variant(s); registered with host blockManager.`
                : `Defined enum set "${input.id}" with ${variants.length} variant(s); host blockManager not present, kept in Watson session only.`,
        }
    },
}

/** Watson-session enum registry. Mirror of what's in the host's
 *  enumSetManager when available, plus a fallback for headless. Read by
 *  the create_block handler when a field declares `field_type: 'enum'`
 *  so it can auto-inject a variant whitelist validation. */
export const _enumSetCache = new Map<
    string,
    {
        id: string
        name: string
        description?: string
        variants: ReadonlyArray<{id: string; value: string; color: string}>
    }
>()

// ---------------------------------------------------------------------------
// 8. list_blocks
// ---------------------------------------------------------------------------

interface ListBlocksInput {
    sheet?: string
}

interface BlockSummary {
    name: string
    position: {row: number; col: number}
    row_count: number
    col_count: number
}

interface SheetBlockGroup {
    sheet_name: string
    sheet_idx: number
    blocks: BlockSummary[]
    /**
     * Suggested (row, col) for the next new block on this sheet, assuming
     * blocks don't share rows (one block per row range). A one-row gap
     * is reserved after the bottom-most block for readability. Use this
     * as the `position` argument to `create_block`. For an empty sheet
     * this is (0, 0).
     */
    next_block_start: {row: number; col: number}
}

export const listBlocks: Tool<ListBlocksInput, SheetBlockGroup[]> = {
    namespace: 'build',
    name: 'list_blocks',
    description:
        'List blocks grouped by sheet, plus a suggested position for the next new block on each sheet. The `next_block_start` field is the row right after the last existing block (assuming blocks never share rows) — pass it as `position` to `create_block`. Omit `sheet` to scan the whole workbook; passing it restricts to one sheet.',
    mutates: false,
    confirmation: 'never',
    cost: 'cheap',
    inputSchema: {
        properties: {
            sheet: {type: 'string'},
        },
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        const sheetInfosRes = await client.getAllSheetInfo()
        if (isErrorMessage(sheetInfosRes)) {
            throw new Error(`getAllSheetInfo failed: ${sheetInfosRes.msg}`)
        }
        const sheetInfos = sheetInfosRes

        // Resolve scope: a specific sheet, or every sheet in the workbook.
        let scope: number[]
        if (input.sheet !== undefined) {
            const matched = sheetInfos.findIndex((s) => s.name === input.sheet)
            if (matched < 0) {
                throw new Error(`No sheet named "${input.sheet}"`)
            }
            scope = [matched]
        } else {
            scope = sheetInfos.map((_, i) => i)
        }

        // Pull blocks once (filtered or not), then group locally.
        const result = await client.getAllBlocks(
            input.sheet !== undefined ? {sheetIdx: scope[0]} : {}
        )
        if (isErrorMessage(result)) {
            throw new Error(`getAllBlocks failed: ${result.msg}`)
        }

        const blocksByIdx = new Map<number, BlockSummary[]>()
        for (const b of result) {
            const arr = blocksByIdx.get(b.sheetIdx) ?? []
            arr.push({
                // BlockSchema.name is the block's refName (the first arg
                // to BLOCKREF / BLOCKREFS in formulas). Schema absent →
                // legacy / ad-hoc block, fall back to "block#<id>".
                name: b.schema?.name ?? `block#${b.blockId}`,
                position: {row: b.rowStart, col: b.colStart},
                row_count: b.rowCnt,
                col_count: b.colCnt,
            })
            blocksByIdx.set(b.sheetIdx, arr)
        }

        // One-row gap between adjacent blocks — pure aesthetic / debug
        // affordance so the canvas isn't a wall of touching rectangles.
        const BLOCK_GAP_ROWS = 1

        const groups: SheetBlockGroup[] = scope.map((idx) => {
            const blocks = blocksByIdx.get(idx) ?? []
            // "Next" row = end of the bottom-most block + gap. col=0 by
            // the "one block per row range" assumption.
            let nextRow = 0
            for (const b of blocks) {
                const endPlusGap = b.position.row + b.row_count + BLOCK_GAP_ROWS
                if (endPlusGap > nextRow) nextRow = endPlusGap
            }
            blocks.sort((a, b) => a.position.row - b.position.row)
            return {
                sheet_name: sheetInfos[idx]?.name ?? `sheet#${idx}`,
                sheet_idx: idx,
                blocks,
                next_block_start: {row: nextRow, col: 0},
            }
        })

        return {data: groups}
    },
}

// ---------------------------------------------------------------------------
// 9. describe_block
// ---------------------------------------------------------------------------

interface DescribeBlockInput {
    name: string
    include_rows?: boolean
}

interface FieldDescription {
    name: string
    /** 0-based column index within the block. */
    position: number
    /** Engine-computed cell value (raw template, no placeholder
     *  expansion). `null` for free-form fields. */
    value_formula: string | null
    /** Per-row boolean rule — host UI renders a warning marker when
     *  it evaluates false. `null` if not declared. */
    validation: string | null
    /** Per-row boolean rule — host permission patch gates writes
     *  when it evaluates false. `null` if not declared. */
    editability: string | null
}

interface DescribeBlockOutput {
    block: string
    sheet: string
    sheet_idx: number
    position: {row: number; col: number}
    row_count: number
    col_count: number
    fields: FieldDescription[]
    /** Row keys in block-row order. Always present (cheap). */
    keys: string[]
    /** Only when `include_rows=true`. Each entry maps every field name
     *  to that cell's current value (string / number / boolean) or
     *  null when empty. Formula errors surface as `"#ERR:..."` strings. */
    rows?: Array<{
        key: string
        values: Record<string, string | number | boolean | null>
    }>
}

export const describeBlock: Tool<DescribeBlockInput, DescribeBlockOutput> = {
    namespace: 'build',
    name: 'describe_block',
    description: [
        "Return a block's full structure for the LLM: identity (name, sheet, position), per-field schema (name, position, value_formula, validation, editability rules — all from the Rust schema, the engine's authoritative source), and row keys in order.",
        '',
        'Pass `include_rows: true` to additionally include current cell values as `rows[].values[fieldName]`. Off by default to save tokens — use it when the agent actually needs to inspect data, not when it only needs the shape.',
    ].join('\n'),
    mutates: false,
    confirmation: 'never',
    cost: 'cheap',
    inputSchema: {
        properties: {
            name: {
                type: 'string',
                description: 'Block ref name (the `name` of create_block).',
            },
            include_rows: {
                type: 'boolean',
                default: false,
                description:
                    'When true, include current cell values. Off by default to save tokens.',
            },
        },
        required: ['name'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)

        // One getAllBlocks + one getAllSheetInfo. We use the workbook-
        // wide variants so a single roundtrip pair fetches everything
        // (vs. resolve sheet idx first, then getBlockInfo per-sheet).
        const [allBlocks, sheetInfosRes] = await Promise.all([
            client.getAllBlocks({}),
            client.getAllSheetInfo(),
        ])
        if (isErrorMessage(allBlocks)) {
            throw new Error(`getAllBlocks failed: ${allBlocks.msg}`)
        }
        if (isErrorMessage(sheetInfosRes)) {
            throw new Error(`getAllSheetInfo failed: ${sheetInfosRes.msg}`)
        }
        const sheetInfos = sheetInfosRes

        const block = allBlocks.find((b) => b.schema?.name === input.name)
        if (!block) {
            throw new Error(`No block with ref name "${input.name}"`)
        }
        const schema = block.schema
        if (!schema) {
            throw new Error(
                `Block "${input.name}" has no schema — was BindFormSchema called?`
            )
        }

        const sheetName =
            sheetInfos[block.sheetIdx]?.name ?? `sheet#${block.sheetIdx}`

        const fields: FieldDescription[] = schema.fields.map((f) => ({
            name: f.field,
            position: f.idx,
            value_formula: nonEmpty(f.valueFormula),
            validation: nonEmpty(f.validationFormula),
            editability: nonEmpty(f.editabilityFormula),
        }))

        // Row keys in block-row order (the `idx` on KeyEntry is the
        // row index; sorting by it gives natural top-to-bottom order).
        const keys = [...schema.keys]
            .sort((a, b) => a.idx - b.idx)
            .map((k) => k.key)

        const out: DescribeBlockOutput = {
            block: input.name,
            sheet: sheetName,
            sheet_idx: block.sheetIdx,
            position: {row: block.rowStart, col: block.colStart},
            row_count: block.rowCnt,
            col_count: block.colCnt,
            fields,
            keys,
        }

        if (input.include_rows) {
            // `cells` is row-major: index = row * colCnt + col.
            const fieldByCol = new Map<number, string>()
            for (const f of schema.fields) fieldByCol.set(f.idx, f.field)

            // Build a key lookup by row index so we can label each row
            // even when the key column isn't 0 (it always is today, but
            // the schema doesn't force that).
            const keyByRow = new Map<number, string>()
            for (const k of schema.keys) keyByRow.set(k.idx, k.key)

            const rows: NonNullable<DescribeBlockOutput['rows']> = []
            for (let r = 0; r < block.rowCnt; r++) {
                const values: Record<string, string | number | boolean | null> =
                    {}
                for (let c = 0; c < block.colCnt; c++) {
                    const fieldName = fieldByCol.get(c)
                    if (!fieldName) continue
                    const cell = block.cells[r * block.colCnt + c]
                    values[fieldName] = cell
                        ? flattenCellValue(cell.value)
                        : null
                }
                rows.push({
                    key: keyByRow.get(r) ?? '',
                    values,
                })
            }
            out.rows = rows
        }

        return {data: out}
    },
}

/** Treat empty / whitespace-only templates as "no rule declared".
 *  The engine normalizes empty → None on its side too. */
function nonEmpty(s: string | undefined | null): string | null {
    if (typeof s !== 'string') return null
    const t = s.trim()
    return t === '' ? null : t
}

/** Flatten an engine `Value` to the JSON-friendly shape used by
 *  describe_block's row values. Errors get a `"#ERR:..."` prefix so
 *  the LLM can tell them from legitimate strings. */
function flattenCellValue(
    v: import('logisheets-web').Value
): string | number | boolean | null {
    if (v === 'empty') return null
    switch (v.type) {
        case 'str':
            return v.value
        case 'number':
            return v.value
        case 'bool':
            return v.value
        case 'error':
            return `#ERR:${v.value}`
    }
}

// ---------------------------------------------------------------------------
// 10. eval_formula
// ---------------------------------------------------------------------------

interface EvalFormulaInput {
    expr: string
}

interface EvalFormulaOutput {
    /** Discriminated tag — `'empty'` when the formula returned an empty cell. */
    type: 'str' | 'number' | 'bool' | 'error' | 'empty'
    /** Coerced JSON value. Empty cells get `null`. Errors get the
     *  engine's error code as a string. */
    value: string | number | boolean | null
}

/** One CraftCalc per Client — keep the handle alive for the session so
 *  repeated eval_formula calls reuse the same ephemeral-id range. */
const _craftCalcByClient = new WeakMap<object, CraftCalc>()

function getCraftCalc(client: Client): CraftCalc {
    const key = client as unknown as object
    let calc = _craftCalcByClient.get(key)
    if (!calc) {
        calc = acquireCraftCalc(client)
        _craftCalcByClient.set(key, calc)
    }
    return calc
}

/** Flatten an engine `Value` into a JSON-friendly `{type, value}` pair
 *  the LLM can read directly without understanding the discriminated
 *  union. */
function flattenValue(v: Value): EvalFormulaOutput {
    if (v === 'empty') return {type: 'empty', value: null}
    switch (v.type) {
        case 'str':
            return {type: 'str', value: v.value}
        case 'number':
            return {type: 'number', value: v.value}
        case 'bool':
            return {type: 'bool', value: v.value}
        case 'error':
            return {type: 'error', value: v.value}
    }
}

export const evalFormula: Tool<EvalFormulaInput, EvalFormulaOutput> = {
    namespace: 'build',
    name: 'eval_formula',
    description: [
        'Evaluate an Excel-style formula in a private scratch cell and return the computed value. Nothing is written to user-visible cells. Returns `{type, value}` where type is one of:',
        '  - "number"  — value is a JS number',
        '  - "str"     — value is a string',
        '  - "bool"    — value is a JS boolean',
        '  - "error"   — value is the Excel error code (e.g. "#REF!", "#NAME?")',
        '  - "empty"   — value is null (formula returned an empty cell)',
        '',
        'Use for:',
        '  - Quick checks: "=SUMIFS(OrderStatus, \\"金额\\", \\"*\\")" → total',
        '  - Sanity-test a candidate template before set_field_rule',
        '  - BLOCKREF / BLOCKREFS lookups against any block in the workbook',
        '',
        'Leading "=" is optional — it is added automatically if missing.',
    ].join('\n'),
    mutates: false,
    confirmation: 'never',
    cost: 'cheap',
    inputSchema: {
        properties: {
            expr: {
                type: 'string',
                description:
                    'Formula, with or without leading "=". E.g. "SUM(A1:A10)" or "=BLOCKREF(\\"orders\\", \\"O001\\", \\"金额\\")".',
            },
        },
        required: ['expr'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        const calc = getCraftCalc(client)
        const v = await calc.calcOnce(input.expr)
        return {
            data: flattenValue(v),
        }
    },
}

// ---------------------------------------------------------------------------
// 11. checkpoint  (save / restore / delete / list by label)
// ---------------------------------------------------------------------------

interface CheckpointInput {
    op: 'save' | 'restore' | 'delete' | 'list'
    /** Required for save / restore / delete. Ignored for list. */
    label?: string
    /** Human-readable note; only meaningful for save, echoed back by list. */
    description?: string
}

interface CheckpointOutput {
    op: 'save' | 'restore' | 'delete' | 'list'
    /** For save: total checkpoint count after the save.
     *  For delete: true if the label existed. */
    result?: number | boolean
    /** For list: enumerated checkpoints (newest first). */
    checkpoints?: ReadonlyArray<{label: string; description?: string}>
}

export const checkpoint: Tool<CheckpointInput, CheckpointOutput> = {
    namespace: 'build',
    name: 'checkpoint',
    description: [
        'Snapshot the workbook so a multi-step build can roll back without chaining N undos. Engine-managed (Rust CheckpointManager) — each label points at a full Status snapshot. Cheap to create thanks to imbl persistent data structures.',
        '',
        'Operations:',
        '  save    — Take a snapshot under `label`. Overwrites if label exists. Does not touch the undo stack (the snapshot is a sidecar; the AI/user can keep working).',
        '  restore — Replace the live workbook with the snapshot stored at `label`. **This itself is undoable**: the user can Ctrl-Z to reverse the restore. Fails loud (`label not found`) if `label` was never saved. Side effect: clears the redo stack (standard new-tx semantics).',
        '  delete  — Remove a saved snapshot by label.',
        '  list    — Enumerate saved checkpoints, newest first.',
        '',
        'Limits:',
        '  - Session-only: snapshots are dropped on file save/load and on page reload.',
        '  - Up to 20 checkpoints; saving when at capacity evicts the oldest. Save the same label again to refresh it back to the front of the FIFO.',
        '  - Independent of user Ctrl-Z/Y history — checkpoints persist across user undo / redo.',
    ].join('\n'),
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            op: {
                type: 'string',
                enum: ['save', 'restore', 'delete', 'list'],
            },
            label: {
                type: 'string',
                description:
                    'Required for save / restore / delete. Ignored for list.',
            },
            description: {
                type: 'string',
                description:
                    'Optional note. Only meaningful for save (echoed back by list).',
            },
        },
        required: ['op'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        switch (input.op) {
            case 'save': {
                const label = requireLabel(input, 'save')
                const res = await client.saveCheckpoint({
                    label,
                    description: input.description,
                } as unknown as Parameters<typeof client.saveCheckpoint>[0])
                if (isErrorMessage(res)) {
                    throw new Error(`save checkpoint failed: ${res.msg}`)
                }
                return {
                    data: {op: 'save', result: res},
                    display: `Saved checkpoint "${label}" (${res} total).`,
                }
            }
            case 'restore': {
                const label = requireLabel(input, 'restore')
                // Restore goes through the standard transaction pipeline
                // — it's a `restoreCheckpoint` payload, so it lands on
                // the undo stack. User can Ctrl-Z to reverse.
                await commitTransaction(
                    client,
                    [
                        {
                            type: 'restoreCheckpoint',
                            value: {label} as unknown as never,
                        } as EditPayload,
                    ],
                    `checkpoint restore "${label}"`
                )
                return {
                    data: {op: 'restore'},
                    display: `Restored workbook to checkpoint "${label}". One Ctrl-Z reverses this.`,
                }
            }
            case 'delete': {
                const label = requireLabel(input, 'delete')
                const existed = await client.deleteCheckpoint({
                    label,
                } as unknown as Parameters<typeof client.deleteCheckpoint>[0])
                if (isErrorMessage(existed)) {
                    throw new Error(`delete checkpoint failed: ${existed.msg}`)
                }
                return {
                    data: {op: 'delete', result: existed},
                    display: existed
                        ? `Deleted checkpoint "${label}".`
                        : `Checkpoint "${label}" did not exist; no-op.`,
                }
            }
            case 'list': {
                const list = await client.listCheckpoints()
                if (isErrorMessage(list)) {
                    throw new Error(`list checkpoints failed: ${list.msg}`)
                }
                return {
                    data: {op: 'list', checkpoints: list},
                    display:
                        list.length === 0
                            ? 'No checkpoints saved.'
                            : `${list.length} checkpoint(s): ${list
                                  .map((c) => c.label)
                                  .join(', ')}.`,
                }
            }
        }
    },
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

export const BUILDER_TOOLS: Tool[] = [
    createSheet,
    createBlock,
    addBlockRows,
    deleteBlockRows,
    setFieldRule,
    defineEnumSet,
    listBlocks,
    describeBlock,
    evalFormula,
    checkpoint,
] as Tool[]
