import {
    BindFormSchemaBuilder,
    BlockInputBuilder,
    CreateBlockBuilder,
    CreateSheetBuilder,
    EditPayload,
    SetColWidthBuilder,
    SetRowHeightBuilder,
    UpsertFieldRenderInfoBuilder,
    isErrorMessage,
} from 'logisheets-web'
import type {Client} from 'logisheets-web'

// Sheet
export const ENGINE_SHEET = 'ENGINE'
// All non-engine blocks (sales / plant / procurement tables) stack on this
// single sheet. The previous per-domain sheets (SALES_DEPARTMENT, PLANT,
// PROCUREMENT) were merged — keep the constants pointing at MAIN_SHEET so
// any external callers that reference them by name still resolve.
export const MAIN_SHEET = 'MAIN'
export const SALES_DEPARTMENT = MAIN_SHEET
export const PLANT = MAIN_SHEET
export const PROCUREMENT = MAIN_SHEET

export const OPTICAL_GLASS_SUPPLIER_1 = '晶河光材'
export const OPTICAL_GLASS_SUPPLIER_2 = '齐辉光学'

export const EQUATORIAL_MOUNT_SUPPLIER_1 = '星整天仪'
export const EQUATORIAL_MOUNT_SUPPLIER_2 = '小林精密'

export const METAL_FITTINGS_SUPPLIER_1 = '黑学材料'
export const METAL_FITTINGS_SUPPLIER_2 = '艾配金属'

export const EXPECTED_YIELD_RATE = '预计良品率'
export const REQUIRED_YIELD_RATE = '良品率'
export const CURRENT_EXPECTED_YIELD_RATE = '本期预计良品率'
export const DELIVERED_YIELD_RATE = '已交付良品率'
export const DELIVERY_DEADLINE = '剩余交付期数'
export const CURRENT_DELIVERY = '本期交付数'
export const REMAINING_DELIVERY = '剩余交付数'

export const REQUIRED_AMOUNT = '数量'

export const UNIT_COST = '单位成本'
export const UNIT_PRICE = '单价'

export const PRODUCTION_LINE = '生产线'
export const PRODUCTION_LINE_1 = '一'
export const PRODUCTION_LINE_2 = '二'

// Field-level convenience: factory-managed fields. The first field of a
// table acts as the key column (keyIdx=0 in bindFormSchema) and is forced
// uneditable regardless of the flag here; the rest carry their own
// userEditable.
const f = (name: string, userEditable = false): Field => ({name, userEditable})

export const SUPPLIER_FIELDS: readonly Field[] = [
    f('供应商'),
    f('良品率'),
    f('每期最大供应'),
    f('单价'),
]

export const CASH = '现金'

export interface Field {
    name: string
    userEditable: boolean
}

export interface Table {
    refName: string
    // keys[i] is written verbatim into row i of the key column (the first
    // field, since keyIdx=0 in bindFormSchema). The key column is always
    // uneditable for the player — keys are row identifiers, not data.
    keys: readonly string[]
    // fields[0] is the key column; its userEditable is ignored (forced to
    // false). fields[i>0] carry their own userEditable to opt-in / opt-out
    // per data column.
    fields: readonly Field[]
}

export const CONSTANTS_TABLE: Table = {
    keys: ['seed'],
    fields: [f('type'), f('value')],
    refName: 'Constants',
}

export const OPTICAL_GLASS_SUPPLIERS_TABLE: Table = {
    keys: [OPTICAL_GLASS_SUPPLIER_1, OPTICAL_GLASS_SUPPLIER_2],
    fields: SUPPLIER_FIELDS,
    refName: 'OpticalGlassSupplier',
}

export const EQUATORIAL_MOUNT_SUPPLIERS_TABLE: Table = {
    keys: [EQUATORIAL_MOUNT_SUPPLIER_1, EQUATORIAL_MOUNT_SUPPLIER_2],
    fields: SUPPLIER_FIELDS,
    refName: 'EquatorialMountSupplier',
}

export const METAL_FITTINGS_SUPPLIERS_TABLE: Table = {
    keys: [METAL_FITTINGS_SUPPLIER_1, METAL_FITTINGS_SUPPLIER_2],
    fields: SUPPLIER_FIELDS,
    refName: 'MetalFittingsSupplier',
}

export const PRODUCTION_LINE_CONTRIBUTION_TABLE: Table = {
    keys: [PRODUCTION_LINE_1, PRODUCTION_LINE_2],
    fields: [
        f(PRODUCTION_LINE),
        f(OPTICAL_GLASS_SUPPLIER_1),
        f(OPTICAL_GLASS_SUPPLIER_2),
        f(EQUATORIAL_MOUNT_SUPPLIER_1),
        f(EQUATORIAL_MOUNT_SUPPLIER_2),
        f(METAL_FITTINGS_SUPPLIER_1),
        f(METAL_FITTINGS_SUPPLIER_2),
        f(EXPECTED_YIELD_RATE),
        f(UNIT_COST),
    ],
    refName: 'ProductionLineContribution',
}

export const ORDER_CONTRIBUTION_TABLE: Table = {
    keys: [],
    fields: [
        f('订单'),
        f(PRODUCTION_LINE_1),
        f(PRODUCTION_LINE_2),
        f(CURRENT_EXPECTED_YIELD_RATE),
        f(DELIVERED_YIELD_RATE),
        f(CURRENT_DELIVERY),
        f(REMAINING_DELIVERY),
    ],
    refName: 'OrderConfiguration',
}

export const ORDER_STATUS_TABLE: Table = {
    keys: [],
    fields: [
        f(REQUIRED_AMOUNT),
        f(REQUIRED_YIELD_RATE),
        f(UNIT_PRICE),
        f('违约罚金'),
        f('是否接受'),
    ],
    refName: 'OrderStatus',
}

export const CONSTRAINTS: Table = {
    keys: [
        // amount limit
        OPTICAL_GLASS_SUPPLIER_1,
        OPTICAL_GLASS_SUPPLIER_2,
        EQUATORIAL_MOUNT_SUPPLIER_1,
        EQUATORIAL_MOUNT_SUPPLIER_2,
        METAL_FITTINGS_SUPPLIER_1,
        METAL_FITTINGS_SUPPLIER_2,
        PRODUCTION_LINE_1,
        PRODUCTION_LINE_2,
        CASH,
    ],
    fields: [f('name'), f('value')],
    refName: 'Constraints',
}

export function createSheet(name: string, idx: number): EditPayload {
    const p = new CreateSheetBuilder().idx(idx).newName(name).build()
    return {
        type: 'createSheet',
        value: p,
    }
}

// Sheets created in this order → indices 0..1
export const SHEET_ORDER = [ENGINE_SHEET, MAIN_SHEET] as const

export const SHEET_IDX: Record<string, number> = Object.fromEntries(
    SHEET_ORDER.map((name, i) => [name, i])
)

// Gap (in rows) between consecutive blocks on the same sheet
const BLOCK_GAP = 5

// Height (in Excel units) for every row occupied by a block — default
// row height is ~15 (≈20px); ~28 (≈37px) gives interactive widgets and
// CJK text comfortable breathing room.
const BLOCK_ROW_HEIGHT = 28

// Symbolic keys used to look up dynamically-assigned block IDs after newGame resolves
export type BlockKey =
    | 'constants'
    | 'constraints'
    | 'orderStatus'
    | 'orderContribution'
    | 'productionLineContribution'
    | 'opticalGlassSuppliers'
    | 'equatorialMountSuppliers'
    | 'metalFittingsSuppliers'

export type BlockIds = Record<BlockKey, number>

interface BlockDef {
    key: BlockKey
    table: Table
    sheet: string
}

// Declaration order within each sheet determines vertical stacking order.
// masterRow is computed automatically from table sizes — no hardcoded positions.
const BLOCK_DEFS: BlockDef[] = [
    // ENGINE — game-wide constraints
    {key: 'constants', table: CONSTRAINTS, sheet: ENGINE_SHEET},
    {key: 'constraints', table: CONSTANTS_TABLE, sheet: ENGINE_SHEET},
    // 销售部 — order tables (variable-length, stacked)
    {
        key: 'orderContribution',
        table: ORDER_CONTRIBUTION_TABLE,
        sheet: SALES_DEPARTMENT,
    },
    {key: 'orderStatus', table: ORDER_STATUS_TABLE, sheet: SALES_DEPARTMENT},
    // 工厂 — production lines
    {
        key: 'productionLineContribution',
        table: PRODUCTION_LINE_CONTRIBUTION_TABLE,
        sheet: PLANT,
    },
    // 采购 — supplier tables
    {
        key: 'opticalGlassSuppliers',
        table: OPTICAL_GLASS_SUPPLIERS_TABLE,
        sheet: PROCUREMENT,
    },
    {
        key: 'equatorialMountSuppliers',
        table: EQUATORIAL_MOUNT_SUPPLIERS_TABLE,
        sheet: PROCUREMENT,
    },
    {
        key: 'metalFittingsSuppliers',
        table: METAL_FITTINGS_SUPPLIERS_TABLE,
        sheet: PROCUREMENT,
    },
]

/** Number of rows a block occupies: one per key for fixed tables, 1 template row for variable. */
function blockRowCnt(table: Table): number {
    return table.keys.length > 0 ? table.keys.length : 1
}

/**
 * Decide the column width (in Excel units) required to display a field name.
 * Returns null if the default width (~8.43 units, ~59px) is already enough —
 * i.e., names that are 2 Chinese characters or shorter.
 */
function colWidthForFieldName(name: string): number | null {
    // Chinese characters render roughly twice as wide as ASCII in the default
    // font, so weight them accordingly.
    const CJK = /[㐀-䶿一-鿿豈-﫿]/
    let visualUnits = 0
    for (const ch of name) {
        visualUnits += CJK.test(ch) ? 2 : 1
    }
    if (visualUnits <= 4) return null // ≤ 2 Chinese chars — default fits
    // ~1.8 Excel units per "visual char" + 2 units of padding.
    return visualUnits * 1.8 + 2
}

/**
 * Initialize a new game.
 *
 * Two-phase commit:
 *   1. Create all sheets, then
 *   2. Query a fresh block ID per sheet for each block, create blocks, bind schemas.
 *
 * Returns the assigned BlockIds map so callers can reference blocks by name.
 */
// Minimal shape of the engine's frontend FieldManager that we touch from the
// craft. Typed loosely to avoid pulling logisheets-engine as a dep.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBlockManager = any

export async function newGame(
    client: Client,
    blockManager: AnyBlockManager
): Promise<BlockIds> {
    // Phase 1 — create sheets.
    // Probe current sheet count, then append our sheets in order.
    console.log('00000000')
    const result = await client.getAllSheetInfo()
    if (isErrorMessage(result)) throw Error('')
    const existingCount = result.length

    const sheetPayloads: EditPayload[] = SHEET_ORDER.map((name, i) =>
        createSheet(name, existingCount + i)
    )
    const sheetTxResult = await client.handleTransaction({
        transaction: {payloads: sheetPayloads, undoable: true, temp: false},
    })
    console.log('1111111')
    if (isErrorMessage(sheetTxResult))
        throw new Error(
            `createSheet transaction failed: ${JSON.stringify(sheetTxResult)}`
        )
    const allSheets = await client.getAllSheetInfo()
    if (isErrorMessage(allSheets)) throw Error('')

    // Record the actual indices (they land exactly where we inserted them)
    SHEET_ORDER.forEach((name, i) => {
        SHEET_IDX[name] = existingCount + i
    })

    // Map sheetIdx → sheetId (the engine's frontend fieldManager keys by sheetId).
    const sheetIdByName: Record<string, number> = {}
    for (const name of SHEET_ORDER) {
        const info = allSheets[SHEET_IDX[name]]
        if (!info)
            throw new Error(`sheet ${name} not found at idx ${SHEET_IDX[name]}`)
        sheetIdByName[name] = info.id
    }

    // Phase 2 — build all block payloads in one transaction.
    // Each sheet is freshly created, so block IDs start at 0 and increment
    // locally per sheet (no need to query getAvailableBlockId).
    const blockIds: Partial<BlockIds> = {}
    const blockPayloads: EditPayload[] = []
    const nextRow: Record<string, number> = {}
    const nextBlockId: Record<string, number> = {}
    // Per-sheet, per-column maximum width required by any block on that
    // sheet. Filled while we walk BLOCK_DEFS; emitted as setColWidth
    // payloads after the loop so each column ends up wide enough for every
    // block stacked on it.
    const requiredColWidth: Record<string, Map<number, number>> = {}
    // Per-sheet set of row indices that belong to any block — every such
    // row gets the uniform BLOCK_ROW_HEIGHT.
    const blockRows: Record<string, Set<number>> = {}

    for (const def of BLOCK_DEFS) {
        const {key, table, sheet} = def
        const sheetIdx = SHEET_IDX[sheet]
        const blockId = nextBlockId[sheet] ?? 0
        nextBlockId[sheet] = blockId + 1
        blockIds[key] = blockId

        const keys = table.keys as readonly string[]
        const fields = table.fields as readonly Field[]
        const rowCnt = blockRowCnt(table)
        const colCnt = fields.length
        const masterRow = nextRow[sheet] ?? 5
        const masterCol = 0
        nextRow[sheet] = masterRow + rowCnt + BLOCK_GAP

        // Record every row this block occupies so we can resize them after
        // the loop.
        const sheetRows = blockRows[sheet] ?? (blockRows[sheet] = new Set())
        for (let r = masterRow; r < masterRow + rowCnt; r++) sheetRows.add(r)

        // Accumulate the widest field name per column across all blocks on
        // this sheet. Emitted once after the BLOCK_DEFS loop completes.
        const sheetCols =
            requiredColWidth[sheet] ?? (requiredColWidth[sheet] = new Map())
        fields.forEach((field, fieldIdx) => {
            const w = colWidthForFieldName(field.name)
            if (w === null) return
            const col = masterCol + fieldIdx
            const existing = sheetCols.get(col) ?? 0
            if (w > existing) sheetCols.set(col, w)
        })

        // Register each field with the frontend FieldManager. The returned
        // FieldInfo.id is the renderId we use both in bindFormSchema (so the
        // block-interface UI can look the field up) and in
        // upsertFieldRenderInfo.
        //
        // fields[0] is the key column (keyIdx=0 in bindFormSchema). Its
        // cells display keys[i] values, which are row identifiers and must
        // never be user-editable — we hard-force userEditable=false for
        // that column regardless of what was declared on fields[0].
        // fields[i>0] carry their own userEditable from the table literal.
        const sheetId = sheetIdByName[sheet]
        const renderIds = fields.map((field, fieldIdx) => {
            const info = blockManager.fieldManager.create(sheetId, blockId, {
                name: field.name,
                type: {type: 'string', validation: ''},
                required: false,
                unique: false,
                userEditable: fieldIdx === 0 ? false : field.userEditable,
            })
            return info.id as string
        })

        blockPayloads.push({
            type: 'createBlock',
            value: new CreateBlockBuilder()
                .sheetIdx(sheetIdx)
                .id(blockId)
                .masterRow(masterRow)
                .masterCol(0)
                .rowCnt(rowCnt)
                .colCnt(colCnt)
                .build(),
        })

        blockPayloads.push({
            type: 'bindFormSchema',
            value: new BindFormSchemaBuilder()
                .refName(table.refName)
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .keyIdx(0)
                .fieldFrom(0)
                .row(true)
                .fields(fields.map((field) => field.name))
                .renderIds(renderIds)
                .build(),
        })

        renderIds.forEach((renderId) => {
            blockPayloads.push({
                type: 'upsertFieldRenderInfo',
                value: new UpsertFieldRenderInfoBuilder()
                    .renderId(renderId)
                    .diyRender(false)
                    .styleUpdate({setNumFmt: ''})
                    .build(),
            })
        })

        keys.forEach((keyName, rowIdx) => {
            blockPayloads.push({
                type: 'blockInput',
                value: new BlockInputBuilder()
                    .sheetIdx(sheetIdx)
                    .blockId(blockId)
                    .row(rowIdx)
                    .col(0)
                    .input(keyName)
                    .build(),
            })
        })

        // Special-case: the Constants block's 'seed' row needs an initial
        // random value (0..1) in its value column so downstream formulas
        // have a stable game seed to read from.
        if (table === CONSTANTS_TABLE) {
            const seedRow = keys.indexOf('seed')
            const valueCol = fields.findIndex((field) => field.name === 'value')
            if (seedRow >= 0 && valueCol >= 0) {
                blockPayloads.push({
                    type: 'blockInput',
                    value: new BlockInputBuilder()
                        .sheetIdx(sheetIdx)
                        .blockId(blockId)
                        .row(seedRow)
                        .col(valueCol)
                        .input(String(Math.random()))
                        .build(),
                })
            }
        }
    }

    // Emit one setColWidth per (sheet, col) after walking all blocks, so
    // every column ends up wide enough for the widest field name placed on
    // it (across all stacked blocks).
    for (const [sheet, cols] of Object.entries(requiredColWidth)) {
        const sheetIdx = SHEET_IDX[sheet]
        for (const [col, width] of cols) {
            blockPayloads.push({
                type: 'setColWidth',
                value: new SetColWidthBuilder()
                    .sheetIdx(sheetIdx)
                    .col(col)
                    .width(width)
                    .build(),
            })
        }
    }

    // Resize every row occupied by a block on each sheet to the uniform
    // BLOCK_ROW_HEIGHT so block content lays out consistently.
    for (const [sheet, rows] of Object.entries(blockRows)) {
        const sheetIdx = SHEET_IDX[sheet]
        for (const row of rows) {
            blockPayloads.push({
                type: 'setRowHeight',
                value: new SetRowHeightBuilder()
                    .sheetIdx(sheetIdx)
                    .row(row)
                    .height(BLOCK_ROW_HEIGHT)
                    .build(),
            })
        }
    }

    const blockTxResult = await client.handleTransaction({
        transaction: {payloads: blockPayloads, undoable: true, temp: false},
    })
    if (isErrorMessage(blockTxResult))
        throw new Error(
            `createBlock transaction failed: ${JSON.stringify(blockTxResult)}`
        )

    return blockIds as BlockIds
}
