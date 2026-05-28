import {
    BindFormSchemaBuilder,
    BlockInputBuilder,
    CreateBlockBuilder,
    CreateSheetBuilder,
    DeleteRowsBuilder,
    DeleteRowsInBlockBuilder,
    EditPayload,
    InsertRowsBuilder,
    InsertRowsInBlockBuilder,
    SetColWidthBuilder,
    SetRowHeightBuilder,
    UpsertFieldRenderInfoBuilder,
    acquireCraftCalc,
    isErrorMessage,
} from 'logisheets-web'
import type {Client, CraftCalc, Value} from 'logisheets-web'

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

// Production-line parameter fields (live in PRODUCTION_LINE_TABLE).
export const FIXED_COST = '固定开销'
export const MAX_PRODUCTION = '最大生产数'
export const PER_UNIT_COST = '每件产品开销'
// Signed adjustment added to the weighted-supplier yield. Positive
// values raise effective yield, negative lower it. Stored as a 0..1
// fraction (e.g. 0.02 = +2%).
export const YIELD_ADJUSTMENT = '良品率影响'

// Contribution-table fields added in this revision.
export const CAPACITY = '本期产能'
export const TOTAL_COST = '所有成本'

export const ORDER_ID = '订单编号'

// Field-level convenience: factory-managed fields. The first field of a
// table acts as the key column (keyIdx=0 in bindFormSchema) and is forced
// uneditable regardless of the flag here; the rest carry their own
// userEditable.
const f = (name: string, userEditable = false): Field => ({name, userEditable})

// Number column shaped for two decimals (e.g. 单价).
const fDecimal = (name: string, userEditable = false): Field => ({
    name,
    userEditable,
    fieldType: 'number',
    numFmt: '0.00',
})

// Number column shaped for percent display with two decimals
// (e.g. 良品率). The stored value is still a 0..1 fraction; the format
// string turns it into "85.00%" at render time.
const fPercent = (name: string, userEditable = false): Field => ({
    name,
    userEditable,
    fieldType: 'number',
    numFmt: '0.00%',
})

// Boolean column. Rendered by the bool-cell widget as ✅/❌ with a click
// toggle; stored as 1 (true) / 0 (false) / empty (unset).
const fBool = (name: string, userEditable = true): Field => ({
    name,
    userEditable,
    fieldType: 'boolean',
})

// Number column driven by a formula template (constraint, not editable).
// See `Field.valueFormula` for placeholder syntax.
const fFormulaDecimal = (name: string, formula: string): Field => ({
    name,
    userEditable: false,
    fieldType: 'number',
    numFmt: '0.00',
    valueFormula: formula,
})

// Same as fFormulaDecimal but with percent formatting (stored value is a
// 0..1 fraction, displayed as e.g. "85.00%"). Used for derived yield
// rates / completion rates.
const fFormulaPercent = (name: string, formula: string): Field => ({
    name,
    userEditable: false,
    fieldType: 'number',
    numFmt: '0.00%',
    valueFormula: formula,
})

// Suppliers have unlimited capacity now — orders pull whatever quantity
// the player decides. `每期最大供应` removed accordingly; only yield and
// price remain as supplier-distinguishing stats.
export const SUPPLIER_FIELDS: readonly Field[] = [
    f('供应商'),
    fPercent('良品率'),
    fDecimal('单价'),
]

export const CASH = '现金'

export type FieldKind = 'string' | 'number' | 'boolean'

export interface Field {
    name: string
    userEditable: boolean
    // Logical type of this column. Defaults to 'string'.
    fieldType?: FieldKind
    // Excel-style number format string (e.g. '0.00%', '0.00', '#,##0').
    // Only meaningful when fieldType === 'number'. Applied both to the
    // FieldInfo.type.formatter (for validation/parsing) and to the
    // cell's render style (setNumFmt) so the canvas displays it.
    numFmt?: string
    /**
     * Optional value formula template. When set, the cell value is
     * derived — at row-insert time the host substitutes the placeholders
     * below and writes the resulting formula into the cell:
     *
     *   `#FIELD("name")` → absolute A1 reference to the same row's cell
     *                       in field `name` (e.g. `E12`)
     *   `#KEY`            → this row's key column value, quoted as a
     *                       string literal
     *
     * Templated fields are constraints — `userEditable` is forced to
     * `false` regardless of what's declared, so the UI offers no edit
     * affordance. The constraint is host-enforced; the engine sees a
     * plain formula.
     */
    valueFormula?: string
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
    keys: ['seed', 'round'],
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

// PRODUCTION_LINE_TABLE — per-line parameters. One row per physical
// line (一 / 二). Craft-seeded; not user-editable in this revision so
// the player can't trivially game the cost model.
export const PRODUCTION_LINE_TABLE: Table = {
    keys: [PRODUCTION_LINE_1, PRODUCTION_LINE_2],
    fields: [
        f(PRODUCTION_LINE),
        fDecimal(FIXED_COST),
        f(MAX_PRODUCTION),
        fDecimal(PER_UNIT_COST),
        fPercent(YIELD_ADJUSTMENT),
    ],
    refName: 'ProductionLine',
}

// Per-material weighted-by-% supplier-yield contribution. Supplier
// columns now hold a 0..1 fraction (UI displays as %). The two
// suppliers' percentages should sum to 1 by player convention
// (constraint enforcement is a TODO — needs validation to grow #FIELD
// substitution, same parser path as value formulas).
const materialYieldExpr = (
    supplierRefName: string,
    s1: string,
    s2: string
): string =>
    `#FIELD("${s1}")*BLOCKREF("${supplierRefName}","${s1}","${REQUIRED_YIELD_RATE}")` +
    `+#FIELD("${s2}")*BLOCKREF("${supplierRefName}","${s2}","${REQUIRED_YIELD_RATE}")`

// Per-material weighted-by-% supplier-price contribution → raw-material
// cost contributed by that material *per finished product*.
const materialUnitCostExpr = (
    supplierRefName: string,
    s1: string,
    s2: string
): string =>
    `#FIELD("${s1}")*BLOCKREF("${supplierRefName}","${s1}","${UNIT_PRICE}")` +
    `+#FIELD("${s2}")*BLOCKREF("${supplierRefName}","${s2}","${UNIT_PRICE}")`

// Expected yield = (sum of per-material weighted yields) / 3  +
// production-line's own 良品率影响 adjustment (signed). When the six
// supplier % sum to 100% per material (3 × 100% = 300%), the divide-by-3
// recovers a proper average in [0, 1].
const EXPECTED_YIELD_FORMULA =
    `=(` +
    materialYieldExpr(
        'OpticalGlassSupplier',
        OPTICAL_GLASS_SUPPLIER_1,
        OPTICAL_GLASS_SUPPLIER_2
    ) +
    `+` +
    materialYieldExpr(
        'EquatorialMountSupplier',
        EQUATORIAL_MOUNT_SUPPLIER_1,
        EQUATORIAL_MOUNT_SUPPLIER_2
    ) +
    `+` +
    materialYieldExpr(
        'MetalFittingsSupplier',
        METAL_FITTINGS_SUPPLIER_1,
        METAL_FITTINGS_SUPPLIER_2
    ) +
    `)/3+BLOCKREF("ProductionLine",#KEY,"${YIELD_ADJUSTMENT}")`

// Per-unit cost = production line's 每件产品开销 + sum of raw-material
// unit costs (each = price × supplier %).
const UNIT_COST_FORMULA =
    `=BLOCKREF("ProductionLine",#KEY,"${PER_UNIT_COST}")+` +
    materialUnitCostExpr(
        'OpticalGlassSupplier',
        OPTICAL_GLASS_SUPPLIER_1,
        OPTICAL_GLASS_SUPPLIER_2
    ) +
    `+` +
    materialUnitCostExpr(
        'EquatorialMountSupplier',
        EQUATORIAL_MOUNT_SUPPLIER_1,
        EQUATORIAL_MOUNT_SUPPLIER_2
    ) +
    `+` +
    materialUnitCostExpr(
        'MetalFittingsSupplier',
        METAL_FITTINGS_SUPPLIER_1,
        METAL_FITTINGS_SUPPLIER_2
    )

// Total cost = 固定开销 + 单位成本 × (最大生产数 × 本期产能%).
// 单位成本 lives in this same row (sibling field) — referenced via
// #FIELD so the formula picks up whichever templated value the engine
// computed for it, even across reorderings.
const TOTAL_COST_FORMULA =
    `=BLOCKREF("ProductionLine",#KEY,"${FIXED_COST}")` +
    `+#FIELD("${UNIT_COST}")` +
    `*BLOCKREF("ProductionLine",#KEY,"${MAX_PRODUCTION}")` +
    `*#FIELD("${CAPACITY}")`

export const PRODUCTION_LINE_CONTRIBUTION_TABLE: Table = {
    keys: [PRODUCTION_LINE_1, PRODUCTION_LINE_2],
    fields: [
        f(PRODUCTION_LINE),
        // Supplier allocations are now percentages — the player splits
        // each material between its two suppliers. Convention: each
        // material's two percentages sum to 100% (see TODO above re
        // engine-enforced cross-field validation).
        fPercent(OPTICAL_GLASS_SUPPLIER_1, true),
        fPercent(OPTICAL_GLASS_SUPPLIER_2, true),
        fPercent(EQUATORIAL_MOUNT_SUPPLIER_1, true),
        fPercent(EQUATORIAL_MOUNT_SUPPLIER_2, true),
        fPercent(METAL_FITTINGS_SUPPLIER_1, true),
        fPercent(METAL_FITTINGS_SUPPLIER_2, true),
        // How much of the line's 最大生产数 we use this round, 0..1.
        fPercent(CAPACITY, true),
        fFormulaPercent(EXPECTED_YIELD_RATE, EXPECTED_YIELD_FORMULA),
        fFormulaDecimal(UNIT_COST, UNIT_COST_FORMULA),
        fFormulaDecimal(TOTAL_COST, TOTAL_COST_FORMULA),
    ],
    refName: 'ProductionLineContribution',
}

export const ORDER_CONTRIBUTION_TABLE: Table = {
    keys: [],
    fields: [
        f('订单'),
        f(PRODUCTION_LINE_1),
        f(PRODUCTION_LINE_2),
        fPercent(CURRENT_EXPECTED_YIELD_RATE),
        fPercent(DELIVERED_YIELD_RATE),
        f(CURRENT_DELIVERY),
        f(REMAINING_DELIVERY),
    ],
    refName: 'OrderConfiguration',
}

export const ORDER_STATUS_TABLE: Table = {
    keys: [],
    fields: [
        f(ORDER_ID),
        f(REQUIRED_AMOUNT),
        f('期数'),
        fPercent(REQUIRED_YIELD_RATE),
        fDecimal(UNIT_PRICE),
        // Penalty = unit price × amount × 0.5 (matches the rate that
        // generateOrder used to bake in statically). Editable=false; the
        // formula is the constraint.
        fFormulaDecimal(
            '违约罚金',
            `=#FIELD("${UNIT_PRICE}") * #FIELD("${REQUIRED_AMOUNT}") * 0.5`
        ),
        fBool('是否接受'),
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

// ----------------------------------------------------------------------
// Initial supplier stats. Each entry is the "base" value for slot 0 (the
// premium / high-quality / low-volume supplier) and slot 1 (the budget /
// lower-quality / high-volume supplier). The seed (0..1) only perturbs
// these uniformly within a category, so the trade-off between the two
// suppliers always survives — the game never degenerates into "one
// supplier is strictly better than the other".
//
// Tweak the constants freely; the code below only reads from this table.
// ----------------------------------------------------------------------
interface SupplierStat {
    yieldRate: number // 良品率 (0..1)
    unitPrice: number // 单价 (currency)
}

const SUPPLIER_BASE_STATS: Record<string, [SupplierStat, SupplierStat]> = {
    // refName → [premium, budget]
    OpticalGlassSupplier: [
        {yieldRate: 0.88, unitPrice: 120},
        {yieldRate: 0.72, unitPrice: 85},
    ],
    EquatorialMountSupplier: [
        {yieldRate: 0.9, unitPrice: 180},
        {yieldRate: 0.7, unitPrice: 130},
    ],
    MetalFittingsSupplier: [
        {yieldRate: 0.92, unitPrice: 60},
        {yieldRate: 0.78, unitPrice: 40},
    ],
}

// How much each per-game tilt can swing the base values. Independent
// multiplier per attribute, applied uniformly to BOTH suppliers in a
// category so the premium/budget trade-off ratio is preserved.
//   ±5% for yield (kept tight so 良品率 stays believable)
//   ±15% for price (more variance to make games feel different)
const YIELD_SPREAD = 0.1
const PRICE_SPREAD = 0.3

/** Derive two independent [0,1) tilts from one seed via simple frac. */
function tiltsFromSeed(seed: number): {
    yieldTilt: number
    priceTilt: number
} {
    const frac = (x: number) => x - Math.floor(x)
    // 1.0 = neutral; (1 ± spread/2) bracket. Each attribute uses a
    // different multiplier on `seed` so the tilts don't move together.
    return {
        yieldTilt: 1 + (frac(seed) - 0.5) * YIELD_SPREAD,
        priceTilt: 1 + (frac(seed * 13) - 0.5) * PRICE_SPREAD,
    }
}

/** Apply the tilts to one slot's base stats, with sensible clamping. */
function rolledSupplierStat(
    base: SupplierStat,
    tilts: ReturnType<typeof tiltsFromSeed>
): SupplierStat {
    const yieldRate = Math.min(0.99, base.yieldRate * tilts.yieldTilt)
    return {
        yieldRate: Math.round(yieldRate * 100) / 100, // 2 decimals
        unitPrice: Math.max(1, Math.round(base.unitPrice * tilts.priceTilt)),
    }
}

// Symbolic keys used to look up dynamically-assigned block IDs after newGame resolves
export type BlockKey =
    | 'constants'
    | 'constraints'
    | 'orderStatus'
    | 'orderContribution'
    | 'productionLine'
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
// Declaration order also matters semantically: BindFormSchema folds
// `BLOCKREF("X", …)` into stable ids at parse time, so any block whose
// templates reference another block by refName MUST be declared after
// that other block. PRODUCTION_LINE_CONTRIBUTION_TABLE's value formulas
// reference both the supplier tables *and* PRODUCTION_LINE_TABLE — both
// land first.
const BLOCK_DEFS: BlockDef[] = [
    // ENGINE — game-wide constraints
    {key: 'constraints', table: CONSTRAINTS, sheet: ENGINE_SHEET},
    {key: 'constants', table: CONSTANTS_TABLE, sheet: ENGINE_SHEET},
    // 销售部 — order tables (variable-length, stacked)
    {
        key: 'orderContribution',
        table: ORDER_CONTRIBUTION_TABLE,
        sheet: SALES_DEPARTMENT,
    },
    {key: 'orderStatus', table: ORDER_STATUS_TABLE, sheet: SALES_DEPARTMENT},
    // 采购 — supplier tables. Must bind before any block whose formulas
    // do BLOCKREF("OpticalGlassSupplier", …) etc.
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
    // 工厂 — production-line parameter table, then the per-line
    // contribution / control panel that references both suppliers and
    // the parameter table.
    {key: 'productionLine', table: PRODUCTION_LINE_TABLE, sheet: PLANT},
    {
        key: 'productionLineContribution',
        table: PRODUCTION_LINE_CONTRIBUTION_TABLE,
        sheet: PLANT,
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
    // Single source of randomness for the whole game. Written into the
    // Constants block's `seed` row and reused to roll the initial
    // supplier stats so the workbook is fully reproducible from this
    // value alone — replay the same seed, get the same game.
    const seed = Math.random()
    const supplierTilts = tiltsFromSeed(seed)

    // Phase 1 — create sheets.
    // Probe current sheet count, then append our sheets in order.
    const result = await client.getAllSheetInfo()
    if (isErrorMessage(result)) throw Error('')
    const existingCount = result.length

    const sheetPayloads: EditPayload[] = SHEET_ORDER.map((name, i) =>
        createSheet(name, existingCount + i)
    )
    const sheetTxResult = await client.handleTransaction({
        transaction: {payloads: sheetPayloads, undoable: true, temp: false},
    })
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
            // Build the FieldTypeEnum variant matching field.fieldType.
            // formatter (on the number variant) and the cell-style
            // setNumFmt below are kept in sync from the same field.numFmt.
            const fieldKind = field.fieldType ?? 'string'
            const numFmt = field.numFmt ?? ''
            const fieldTypeSpec =
                fieldKind === 'number'
                    ? {type: 'number', validation: '', formatter: numFmt}
                    : fieldKind === 'boolean'
                    ? {type: 'boolean'}
                    : {type: 'string', validation: ''}

            const info = blockManager.fieldManager.create(sheetId, blockId, {
                name: field.name,
                type: fieldTypeSpec,
                required: false,
                unique: false,
                // Key column is forced uneditable here; templated fields
                // are forced uneditable by FieldManager.create itself
                // when `valueFormula` is set.
                userEditable: fieldIdx === 0 ? false : field.userEditable,
                valueFormula: field.valueFormula,
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
                // Per-field value-formula templates: empty string for
                // free-form fields. Engine validates `#FIELD("X")`
                // references at bind time.
                .fieldFormulas(fields.map((field) => field.valueFormula ?? ''))
                .build(),
        })

        renderIds.forEach((renderId, fieldIdx) => {
            // Forward the field's number format to the cell render style
            // so the canvas displays values like "85.00%" / "120.00"
            // instead of raw numbers. Non-number fields fall through to
            // empty (default formatter).
            //
            // `diyRender = true` means the block-interface widget owns
            // the visual — the engine shouldn't also paint the raw
            // value underneath. Boolean cells need this so the canvas
            // doesn't render "1" / "0" behind the ✅ / ❌ widget. Other
            // field kinds (string, number, percent…) want the engine's
            // built-in renderer.
            const fieldKind = fields[fieldIdx]?.fieldType ?? 'string'
            const numFmt = fields[fieldIdx]?.numFmt ?? ''
            blockPayloads.push({
                type: 'upsertFieldRenderInfo',
                value: new UpsertFieldRenderInfoBuilder()
                    .renderId(renderId)
                    .diyRender(fieldKind === 'boolean')
                    .styleUpdate({setNumFmt: numFmt})
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

        // Special-case: the Constants block's 'seed' row stores the game
        // seed so downstream formulas have a stable random source. The
        // 'round' row starts at 1 and is bumped by tick().
        if (table === CONSTANTS_TABLE) {
            const valueCol = fields.findIndex((field) => field.name === 'value')
            const writeConstant = (rowKey: string, value: string | number) => {
                const row = keys.indexOf(rowKey)
                if (row < 0 || valueCol < 0) return
                blockPayloads.push({
                    type: 'blockInput',
                    value: new BlockInputBuilder()
                        .sheetIdx(sheetIdx)
                        .blockId(blockId)
                        .row(row)
                        .col(valueCol)
                        .input(String(value))
                        .build(),
                })
            }
            writeConstant('seed', seed)
            writeConstant('round', 1)
        }

        // Supplier tables: roll initial stats (良品率 / 单价) from the
        // seed and write them into the block. `每期最大供应` is gone —
        // suppliers now have unlimited capacity, so only yield and
        // price remain as differentiating stats.
        const supplierBase = SUPPLIER_BASE_STATS[table.refName]
        if (supplierBase) {
            const yieldCol = fields.findIndex((fi) => fi.name === '良品率')
            const priceCol = fields.findIndex((fi) => fi.name === '单价')

            keys.forEach((_, rowIdx) => {
                const base = supplierBase[rowIdx]
                if (!base) return
                const rolled = rolledSupplierStat(base, supplierTilts)

                const writeCell = (col: number, value: string | number) => {
                    if (col < 0) return
                    blockPayloads.push({
                        type: 'blockInput',
                        value: new BlockInputBuilder()
                            .sheetIdx(sheetIdx)
                            .blockId(blockId)
                            .row(rowIdx)
                            .col(col)
                            .input(String(value))
                            .build(),
                    })
                }

                writeCell(yieldCol, rolled.yieldRate)
                writeCell(priceCol, rolled.unitPrice)
            })
        }

        // Production-line parameter table: seed per-line constants so
        // the contribution table's BLOCKREF lookups have real values to
        // multiply against. Player-facing as a read-only reference for
        // now (userEditable=false on every field).
        if (table === PRODUCTION_LINE_TABLE) {
            const fixedCol = fields.findIndex((fi) => fi.name === FIXED_COST)
            const maxCol = fields.findIndex((fi) => fi.name === MAX_PRODUCTION)
            const perUnitCol = fields.findIndex(
                (fi) => fi.name === PER_UNIT_COST
            )
            const yieldAdjCol = fields.findIndex(
                (fi) => fi.name === YIELD_ADJUSTMENT
            )
            // Defaults — tweak freely. Line 一 = cheaper to run with
            // a small yield boost; Line 二 = higher capacity and lower
            // per-unit, but a small yield penalty (player picks the
            // trade-off via 本期产能).
            const defaults: Record<string, [number, number, number, number]> = {
                [PRODUCTION_LINE_1]: [1000, 100, 10, 0.02],
                [PRODUCTION_LINE_2]: [1500, 150, 8, -0.01],
            }
            keys.forEach((keyName, rowIdx) => {
                const d = defaults[keyName]
                if (!d) return
                const writeCell = (col: number, value: number) => {
                    if (col < 0) return
                    blockPayloads.push({
                        type: 'blockInput',
                        value: new BlockInputBuilder()
                            .sheetIdx(sheetIdx)
                            .blockId(blockId)
                            .row(rowIdx)
                            .col(col)
                            .input(String(value))
                            .build(),
                    })
                }
                writeCell(fixedCol, d[0])
                writeCell(maxCol, d[1])
                writeCell(perUnitCol, d[2])
                writeCell(yieldAdjCol, d[3])
            })
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

    // Bind the percent-allocator overlay onto each production-line row's
    // supplier-% pairs. The host renders a +/- badge over each cell that
    // moves percentage between the two suppliers of a material so they
    // always sum to 100%. Three groups per row × two rows = six groups.
    const resolvedBlockIds = blockIds as BlockIds
    registerSupplierPercentAllocators(
        resolvedBlockIds.productionLineContribution
    )

    return resolvedBlockIds
}

// ----------------------------------------------------------------------------
// Wire the host's percent-allocator overlay to each supplier-% cell pair
// in PRODUCTION_LINE_CONTRIBUTION_TABLE. Each (production-line row, material)
// is its own group; clicking +/- on either supplier cell in a pair shifts
// percentage between them so the pair sums to 100%.
//
// Called once at newGame; the bindings live in host memory and survive as
// long as the iframe does. We re-register on every newGame to keep the
// behavior deterministic across replays.
// ----------------------------------------------------------------------------
function registerSupplierPercentAllocators(blockId: number): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const register = w.registerPercentAllocator as
        | ((b: {
              type: 'percentAllocator'
              groupId: string
              sheetIdx: number
              blockId: number
              row: number
              col: number
          }) => void)
        | undefined
    const clear = w.clearPercentAllocators as
        | ((groupId?: string) => void)
        | undefined
    if (!register) return // host predates the percent-allocator API

    // Wipe any leftovers from the previous game so a fresh registration
    // doesn't double-bind the same cells.
    if (clear) clear()

    const sheetIdx = SHEET_IDX[MAIN_SHEET]
    const colOf = (name: string) =>
        PRODUCTION_LINE_CONTRIBUTION_TABLE.fields.findIndex(
            (f) => f.name === name
        )
    const materialPairs: ReadonlyArray<readonly [string, string, string]> = [
        ['glass', OPTICAL_GLASS_SUPPLIER_1, OPTICAL_GLASS_SUPPLIER_2],
        ['mount', EQUATORIAL_MOUNT_SUPPLIER_1, EQUATORIAL_MOUNT_SUPPLIER_2],
        ['fittings', METAL_FITTINGS_SUPPLIER_1, METAL_FITTINGS_SUPPLIER_2],
    ]

    PRODUCTION_LINE_CONTRIBUTION_TABLE.keys.forEach((_line, row) => {
        for (const [material, s1, s2] of materialPairs) {
            const groupId = `plant-line${row}-${material}`
            const c1 = colOf(s1)
            const c2 = colOf(s2)
            if (c1 < 0 || c2 < 0) continue
            register({
                type: 'percentAllocator',
                groupId,
                sheetIdx,
                blockId,
                row,
                col: c1,
            })
            register({
                type: 'percentAllocator',
                groupId,
                sheetIdx,
                blockId,
                row,
                col: c2,
            })
        }
    })
}

// Lazily-acquired CraftCalc handle. The factory-simulator is one craft;
// it gets a single private range of ephemeral cell ids and uses calcOnce
// for any BLOCKREF-style ad-hoc reads.
let _calc: CraftCalc | undefined
function getCalc(client: Client): CraftCalc {
    if (!_calc) _calc = acquireCraftCalc(client)
    return _calc
}

/**
 * Read one cell from a block-backed table by (table refName, key, field)
 * via the BLOCKREF formula. Evaluated on the craft's private ephemeral
 * scratch slot — no shadow cell, no sheet/block/row/col plumbing.
 */
export async function readBlockRef(
    client: Client,
    refName: string,
    key: string,
    field: string
): Promise<Value> {
    const escaped = (s: string) => s.replace(/"/g, '""')
    return getCalc(client).calcOnce(
        `BLOCKREF("${escaped(refName)}", "${escaped(key)}", "${escaped(
            field
        )}")`
    )
}

/**
 * Advance the game to the next round.
 *
 * Reads the current `round` from the Constants table via the BLOCKREF
 * formula (so we never have to thread blockIds / rowIds / colIds), writes
 * `round + 1` back through a temp blockInput payload, then commits the
 * temp status so the bump becomes part of the canonical workbook state.
 */
export async function tick(
    client: Client,
    blockIds: BlockIds
): Promise<number> {
    const value = await readBlockRef(
        client,
        CONSTANTS_TABLE.refName,
        'round',
        'value'
    )
    const current =
        value !== 'empty' && value.type === 'number'
            ? value.value
            : value !== 'empty' && value.type === 'str'
            ? Number(value.value)
            : NaN
    const next = (Number.isFinite(current) ? current : 0) + 1

    const sheetIdx = SHEET_IDX[ENGINE_SHEET]
    const blockId = blockIds.constants
    const roundRowIdx = CONSTANTS_TABLE.keys.indexOf('round')
    const valueColIdx = CONSTANTS_TABLE.fields.findIndex(
        (field) => field.name === 'value'
    )

    const tx = await client.handleTransaction({
        transaction: {
            payloads: [
                {
                    type: 'blockInput',
                    value: new BlockInputBuilder()
                        .sheetIdx(sheetIdx)
                        .blockId(blockId)
                        .row(roundRowIdx)
                        .col(valueColIdx)
                        .input(String(next))
                        .build(),
                },
            ],
            undoable: true,
            temp: true,
        },
    })
    if (isErrorMessage(tx))
        throw new Error(`tick transaction failed: ${JSON.stringify(tx)}`)

    await client.commitTempStatus()
    return next
}

// ============================================================================
// Order generation
// ----------------------------------------------------------------------------
// All knobs that shape orders (id prefix, quality curve, amount sourcing,
// price / deadline / penalty defaults) live in this section. Tweak them
// freely — the insertion code below treats `GeneratedOrder` as a plain
// data bag and won't care.
// ============================================================================

/** One generated order, ready to be written into ORDER_STATUS_TABLE. */
export interface GeneratedOrder {
    orderId: string
    amount: number
    deadlineRounds: number
    yieldRate: number // 0..1, displayed as '0.00%'
    unitPrice: number
    penalty: number
    accepted: string // 是否接受 — '' until the player decides
}

/** Numeric prefix shared by every order id in a game. */
export const ORDER_ID_PREFIX = 715

/**
 * Required yield rate scales with round so early game forgives sloppy
 * production and late game punishes it. Tweak the curve here.
 */
export function orderQualityFromRound(round: number): number {
    return Math.min(0.99, 0.8 + 0.01 * round)
}

/**
 * Stand-in for the not-yet-modeled sales-department capability. Returning
 * a constant 10 keeps order sizing deterministic until the sales metric
 * lands in CONSTRAINTS or somewhere similar.
 */
export const SALES_CAPACITY_PLACEHOLDER = 10
export function orderAmountFromCapacity(capacity: number): number {
    return capacity
}

/** Defaults for the order fields not yet driven by other game state. */
const ORDER_DEFAULT_DEADLINE = 3
const ORDER_DEFAULT_UNIT_PRICE = 200
const ORDER_PENALTY_RATE = 0.5 // fraction of (price * amount)

/**
 * Build one order from the round number and its position within the
 * round. `salesCapacity` is the placeholder hook for the eventual
 * sales-department metric; default uses {@link SALES_CAPACITY_PLACEHOLDER}.
 */
export function generateOrder(
    round: number,
    indexInRound: number,
    salesCapacity: number = SALES_CAPACITY_PLACEHOLDER
): GeneratedOrder {
    const amount = orderAmountFromCapacity(salesCapacity)
    const yieldRate = orderQualityFromRound(round)
    const unitPrice = ORDER_DEFAULT_UNIT_PRICE
    return {
        orderId: `${ORDER_ID_PREFIX}-${round}-${indexInRound}`,
        amount,
        deadlineRounds: ORDER_DEFAULT_DEADLINE,
        yieldRate,
        unitPrice,
        penalty: Math.round(unitPrice * amount * ORDER_PENALTY_RATE),
        accepted: '',
    }
}

// ============================================================================
// Inserting an order into ORDER_STATUS_TABLE
// ----------------------------------------------------------------------------
// The block grows by one row per order. Just calling `insertRowsInBlock`
// would extend the block downward into rows already occupied by the next
// block on the sheet (suppliers, production lines, …). To make room first
// we issue a sheet-level `insertRows` at the row immediately after the
// block's current last row — that shifts every block below it down by one
// — and only then grow the block into the now-empty row.
//
// Exception: when the block is still at its initial empty template row
// (rowCnt == 1 and row 0 is empty), we write directly into row 0 instead
// of growing. This keeps the block's "first order goes in row 0"
// invariant and avoids leaving a stray blank row at the top forever.
// ============================================================================

/**
 * Map field name → string content to write into that field's cell for an
 * order row. Fields with a `valueFormula` template are absent here — the
 * substitution helper writes their formula instead.
 */
function orderRowValueByField(order: GeneratedOrder): Record<string, string> {
    return {
        [ORDER_ID]: order.orderId,
        [REQUIRED_AMOUNT]: String(order.amount),
        期数: String(order.deadlineRounds),
        [REQUIRED_YIELD_RATE]: String(order.yieldRate),
        [UNIT_PRICE]: String(order.unitPrice),
        是否接受: order.accepted,
        // '违约罚金' deliberately omitted — driven by valueFormula.
    }
}

/**
 * Write `order` into the next available row of ORDER_STATUS_TABLE,
 * growing the block (and shifting downstream blocks on the sheet) as
 * needed. Returns the row index inside the block where the order landed.
 */
export async function insertOrder(
    client: Client,
    blockIds: BlockIds,
    order: GeneratedOrder
): Promise<number> {
    const sheetIdx = SHEET_IDX[MAIN_SHEET]
    const blockId = blockIds.orderStatus

    const sheetIdResp = await client.getSheetId({sheetIdx})
    if (isErrorMessage(sheetIdResp))
        throw new Error(`getSheetId failed: ${JSON.stringify(sheetIdResp)}`)
    const sheetId = sheetIdResp

    const info = await client.getBlockInfo({sheetId, blockId})
    if (isErrorMessage(info))
        throw new Error(`getBlockInfo failed: ${JSON.stringify(info)}`)

    // Detect the "still on the initial empty template row" case so the
    // first order takes row 0 instead of leaving it blank forever.
    const row0Empty =
        info.rowCnt === 1 && info.cells.every((c) => isCellEmpty(c.value))

    const targetRow = row0Empty ? 0 : info.rowCnt
    const payloads: EditPayload[] = []

    if (!row0Empty) {
        // Make sheet-level room first so the block can grow without
        // bumping into whatever block sits right below it.
        payloads.push({
            type: 'insertRows',
            value: new InsertRowsBuilder()
                .sheetIdx(sheetIdx)
                .start(info.rowStart + info.rowCnt)
                .count(1)
                .build(),
        })
        payloads.push({
            type: 'insertRowsInBlock',
            value: new InsertRowsInBlockBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .start(info.rowCnt)
                .cnt(1)
                .build(),
        })
    }

    const valueByName = orderRowValueByField(order)
    ORDER_STATUS_TABLE.fields.forEach((field, colIdx) => {
        // Templated fields are constraints — the engine materializes
        // the value from the schema's `valueFormula` when it sees this
        // blockInput. We still need to send the payload so the engine's
        // BlockInput arm fires; content is irrelevant and gets dropped.
        const content = field.valueFormula ? '' : valueByName[field.name] ?? ''
        payloads.push({
            type: 'blockInput',
            value: new BlockInputBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .row(targetRow)
                .col(colIdx)
                .input(content)
                .build(),
        })
    })

    const tx = await client.handleTransaction({
        transaction: {payloads, undoable: true, temp: false},
    })
    if (isErrorMessage(tx))
        throw new Error(`insertOrder transaction failed: ${JSON.stringify(tx)}`)
    return targetRow
}

// ============================================================================
// OrderConfiguration: order acceptance → row added/removed in plant table
// ----------------------------------------------------------------------------
// When the player accepts an order we copy its id into the
// ORDER_CONTRIBUTION_TABLE (plant view) so they can plan production lines
// against it; toggling back to "not accepted" drops the corresponding row.
// Same sheet-then-block insertion / deletion dance as ORDER_STATUS_TABLE.
// ============================================================================

const isCellEmpty = (v: Value | undefined): boolean =>
    v === undefined || v === 'empty' || (v.type === 'str' && v.value === '')

function cellValueAsString(v: Value | undefined): string {
    if (v === undefined || v === 'empty') return ''
    if (v.type === 'str') return v.value
    if (v.type === 'number') return String(v.value)
    if (v.type === 'bool') return v.value ? '1' : '0'
    return ''
}

/**
 * Append `orderId` as a new row in ORDER_CONTRIBUTION_TABLE (the plant
 * view), growing the block and the sheet symmetrically. Reuses the
 * initial template row if the block is still in its empty state.
 *
 * Returns the row index inside the block where the order landed.
 */
export async function insertOrderConfig(
    client: Client,
    blockIds: BlockIds,
    orderId: string
): Promise<number> {
    const sheetIdx = SHEET_IDX[MAIN_SHEET]
    const blockId = blockIds.orderContribution

    const sheetIdResp = await client.getSheetId({sheetIdx})
    if (isErrorMessage(sheetIdResp))
        throw new Error(`getSheetId failed: ${JSON.stringify(sheetIdResp)}`)
    const info = await client.getBlockInfo({sheetId: sheetIdResp, blockId})
    if (isErrorMessage(info))
        throw new Error(`getBlockInfo failed: ${JSON.stringify(info)}`)

    // Dedup: if a row with this orderId is already in the block, no-op.
    // Acceptance toggles can re-fire (e.g. user clicks twice, or a
    // future round-recovery path re-emits), so insertOrderConfig must
    // be idempotent.
    const orderColLookup = ORDER_CONTRIBUTION_TABLE.fields.findIndex(
        (f) => f.name === '订单'
    )
    if (orderColLookup >= 0) {
        for (let r = 0; r < info.rowCnt; r++) {
            const cell = info.cells[r * info.colCnt + orderColLookup]
            if (cell && cellValueAsString(cell.value) === orderId) return r
        }
    }

    const row0Empty =
        info.rowCnt === 1 && info.cells.every((c) => isCellEmpty(c.value))
    const targetRow = row0Empty ? 0 : info.rowCnt
    const payloads: EditPayload[] = []

    if (!row0Empty) {
        payloads.push({
            type: 'insertRows',
            value: new InsertRowsBuilder()
                .sheetIdx(sheetIdx)
                .start(info.rowStart + info.rowCnt)
                .count(1)
                .build(),
        })
        payloads.push({
            type: 'insertRowsInBlock',
            value: new InsertRowsInBlockBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .start(info.rowCnt)
                .cnt(1)
                .build(),
        })
    }

    // Only the 订单 column is populated — production-line counts and
    // yield/delivery columns stay empty for the player to fill in.
    const orderCol = ORDER_CONTRIBUTION_TABLE.fields.findIndex(
        (f) => f.name === '订单'
    )
    if (orderCol >= 0) {
        payloads.push({
            type: 'blockInput',
            value: new BlockInputBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .row(targetRow)
                .col(orderCol)
                .input(orderId)
                .build(),
        })
    }

    // temp:true — this fires in response to a player toggling ✅/❌
    // (the bool-cell commit is itself temp via the host's global temp
    // mode), so we must stay on the same temp branch. A non-temp tx
    // would discard the bool-cell's just-committed "1" via the
    // controller's "non-temp clears temp branch" rule.
    const tx = await client.handleTransaction({
        transaction: {payloads, undoable: true, temp: true},
    })
    if (isErrorMessage(tx))
        throw new Error(
            `insertOrderConfig transaction failed: ${JSON.stringify(tx)}`
        )
    return targetRow
}

/**
 * Find and remove the row in ORDER_CONTRIBUTION_TABLE whose 订单 cell
 * matches `orderId`. Symmetric to {@link insertOrderConfig}: shrinks
 * the block AND reclaims the sheet row. If the row being removed is
 * the only row, clears its cells back to the empty template instead
 * (keeps the block at rowCnt=1).
 *
 * Returns true if a matching row was found and removed.
 */
export async function removeOrderConfig(
    client: Client,
    blockIds: BlockIds,
    orderId: string
): Promise<boolean> {
    const sheetIdx = SHEET_IDX[MAIN_SHEET]
    const blockId = blockIds.orderContribution

    const sheetIdResp = await client.getSheetId({sheetIdx})
    if (isErrorMessage(sheetIdResp))
        throw new Error(`getSheetId failed: ${JSON.stringify(sheetIdResp)}`)
    const info = await client.getBlockInfo({sheetId: sheetIdResp, blockId})
    if (isErrorMessage(info))
        throw new Error(`getBlockInfo failed: ${JSON.stringify(info)}`)

    const orderCol = ORDER_CONTRIBUTION_TABLE.fields.findIndex(
        (f) => f.name === '订单'
    )
    if (orderCol < 0) return false

    // BlockInfo.cells is row-major.
    let targetRow = -1
    for (let r = 0; r < info.rowCnt; r++) {
        const cell = info.cells[r * info.colCnt + orderCol]
        if (cell && cellValueAsString(cell.value) === orderId) {
            targetRow = r
            break
        }
    }
    if (targetRow < 0) return false

    const payloads: EditPayload[] = []
    if (info.rowCnt > 1) {
        payloads.push({
            type: 'deleteRowsInBlock',
            value: new DeleteRowsInBlockBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .start(targetRow)
                .cnt(1)
                .build(),
        })
        payloads.push({
            type: 'deleteRows',
            value: new DeleteRowsBuilder()
                .sheetIdx(sheetIdx)
                .start(info.rowStart + targetRow)
                .count(1)
                .build(),
        })
    } else {
        // Removing the only row would shrink the block to 0; clear
        // cells instead so the next insert can reuse this template row.
        ORDER_CONTRIBUTION_TABLE.fields.forEach((_, colIdx) => {
            payloads.push({
                type: 'blockInput',
                value: new BlockInputBuilder()
                    .sheetIdx(sheetIdx)
                    .blockId(blockId)
                    .row(0)
                    .col(colIdx)
                    .input('')
                    .build(),
            })
        })
    }

    // temp:true — same rationale as insertOrderConfig: stay on the
    // bool-cell's temp branch so its commit isn't discarded.
    const tx = await client.handleTransaction({
        transaction: {payloads, undoable: true, temp: true},
    })
    if (isErrorMessage(tx))
        throw new Error(
            `removeOrderConfig transaction failed: ${JSON.stringify(tx)}`
        )
    return true
}

// ============================================================================
// Cell-value subscriptions
// ----------------------------------------------------------------------------
// The underlying Client API (registerCellValueChangedCallback) takes
// sheet-level (sheetIdx, rowIdx, colIdx) and snapshots the cell id at
// registration time — so the subscription tracks the *cell*, not the
// position, and survives later row insertions. These helpers translate
// the craft-native "block + (blockRow, blockCol)" addressing into sheet
// coordinates so callers don't have to chase rowStart themselves.
// ============================================================================

/**
 * Subscribe to a block cell by (refName, key, field) — same triple the
 * BLOCKREF formula uses. Resolves to a stable cell id via the engine's
 * `getCellIdByBlockRef`, so the subscription tracks the cell even if
 * row insertions shift it around on the sheet.
 *
 * The callback fires with no arguments; re-read via `readBlockRef` (or
 * any other path) when notified.
 */
export async function watchByBlockRef(
    client: Client,
    refName: string,
    key: string,
    field: string,
    callback: () => void
): Promise<void> {
    const cellId = await client.getCellIdByBlockRef({refName, key, field})
    if (isErrorMessage(cellId))
        throw new Error(`getCellIdByBlockRef failed: ${JSON.stringify(cellId)}`)
    client.registerCellValueChangedByCellId(cellId, () => callback())
}

/**
 * Convenience for the most common factory-simulator subscription:
 * "did the player accept order `orderId` this round?". Backed by the
 * host-side block-interface edit bus (`window.onBlockCellEdit`) — fires
 * synchronously after the user commits a click on the 是否接受 cell,
 * with the new boolean value.
 *
 * Returns a disposer; call it to unsubscribe. Disposers for all orders
 * are also flushed automatically by {@link clearAllOrders} so callers
 * don't usually need to track them by hand.
 */
export function watchOrderAccepted(
    client: Client,
    orderId: string,
    callback: (accepted: boolean) => void
): () => void {
    ensureOrderAcceptBridge(client)
    orderAcceptListeners.set(orderId, callback)
    return () => {
        orderAcceptListeners.delete(orderId)
    }
}

// ============================================================================
// Per-round order lifecycle: clearAllOrders + advanceRound
// ----------------------------------------------------------------------------
// Each round we wipe last round's orders (cells + rows + subscriptions),
// bump the round counter, then generate this round's orders. Insertion
// added rows symmetrically to the sheet and the block; deletion must
// mirror that — DeleteRowsInBlock to shrink the block back to its empty
// template, plus DeleteRows on the sheet to reclaim the rows that
// InsertRows added.
// ============================================================================

// Map of orderId → callback for the current round. Cleared at round end.
const orderAcceptListeners = new Map<string, (accepted: boolean) => void>()

// Single bus listener installed once per craft session. We can't install
// it at module load because `window.onBlockCellEdit` is injected by the
// host *after* the iframe mounts; install lazily on first subscribe.
let _orderAcceptBridgeInstalled = false
function ensureOrderAcceptBridge(client: Client): void {
    if (_orderAcceptBridgeInstalled) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onBlockCellEdit = (window as any).onBlockCellEdit as
        | ((cb: (e: BlockCellEditEvent) => void) => () => void)
        | undefined
    if (!onBlockCellEdit) return
    _orderAcceptBridgeInstalled = true
    onBlockCellEdit(async (e) => {
        if (e.refName !== ORDER_STATUS_TABLE.refName) return
        if (e.fieldName !== '是否接受') return
        // Look up the orderId by reading the row's 订单编号 cell. The
        // block's master col is 0 and 订单编号 is field 0, so sheet col 0.
        const cell = await client.getCell({
            sheetIdx: e.sheetIdx,
            row: e.rowIdx,
            col: 0,
        })
        if (isErrorMessage(cell)) return
        const v = cell.value
        const orderId =
            v === 'empty' ? '' : v.type === 'str' ? v.value : String(v.value)
        const cb = orderAcceptListeners.get(orderId)
        if (cb) cb(e.newValue === '1')
    })
}

// Minimal shape of a BlockCellEditEvent — we don't import the host's
// type to avoid a tight coupling to a host-internal module. The shape
// is the contract documented in src/components/block-interface/edit-bus.ts.
interface BlockCellEditEvent {
    sheetIdx: number
    rowIdx: number
    colIdx: number
    sheetId: number
    blockId: number
    fieldId: string
    fieldName: string
    refName?: string
    newValue: string
}

/**
 * Drop every current order: clears the per-order subscriptions, then
 * symmetrically undoes what {@link insertOrder} did — shrinks the block
 * back to its initial 1-row empty template AND removes the matching
 * rows from the sheet so the block doesn't drift further down each
 * round.
 *
 * Safe to call when the block is already empty (no orders inserted yet).
 */
export async function clearAllOrders(
    client: Client,
    blockIds: BlockIds
): Promise<void> {
    orderAcceptListeners.clear()
    // NOTE: clearAllOrders intentionally does NOT call cleanTempStatus
    // or commitTempStatus. The engine already applies the "non-temp tx
    // discards any active temp branch" rule when our wipe transactions
    // (temp:false) reach handle_action — that's its job, not ours.
    // Issuing an explicit clean here previously caused subtle ordering
    // bugs where the wipe's getBlockInfo read pre-clean state while
    // the actual delete ran against post-clean state. Each round is
    // just: append wipe payloads, append fill payloads, let the engine
    // decide what to do with the temp branch underneath.

    // Wipe both blocks: ORDER_STATUS holds the listed orders, and
    // ORDER_CONFIGURATION holds whichever of last round's orders the
    // player had accepted — both stale once the round advances.
    const sheetIdx = SHEET_IDX[MAIN_SHEET]
    await wipeBlockRows(
        client,
        sheetIdx,
        blockIds.orderStatus,
        ORDER_STATUS_TABLE.fields.length,
        'orderStatus'
    )
    await wipeBlockRows(
        client,
        sheetIdx,
        blockIds.orderContribution,
        ORDER_CONTRIBUTION_TABLE.fields.length,
        'orderContribution'
    )
}

/**
 * Shrink a block back to its initial single empty template row. Used by
 * round transitions: reclaims the sheet rows the per-order inserts
 * added (so downstream blocks don't drift further down each round) and
 * clears the surviving row's cells.
 */
async function wipeBlockRows(
    client: Client,
    sheetIdx: number,
    blockId: number,
    colCnt: number,
    _label: string
): Promise<void> {
    const sheetIdResp = await client.getSheetId({sheetIdx})
    if (isErrorMessage(sheetIdResp))
        throw new Error(`getSheetId failed: ${JSON.stringify(sheetIdResp)}`)
    const info = await client.getBlockInfo({sheetId: sheetIdResp, blockId})
    if (isErrorMessage(info))
        throw new Error(`getBlockInfo failed: ${JSON.stringify(info)}`)

    const payloads: EditPayload[] = []
    if (info.rowCnt > 1) {
        payloads.push({
            type: 'deleteRowsInBlock',
            value: new DeleteRowsInBlockBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .start(1)
                .cnt(info.rowCnt - 1)
                .build(),
        })
    }
    for (let c = 0; c < colCnt; c++) {
        payloads.push({
            type: 'blockInput',
            value: new BlockInputBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .row(0)
                .col(c)
                .input('')
                .build(),
        })
    }

    const tx = await client.handleTransaction({
        transaction: {payloads, undoable: true, temp: false},
    })
    if (isErrorMessage(tx))
        throw new Error(`wipeBlockRows failed: ${JSON.stringify(tx)}`)
}

/** How many orders to generate per round. Tweakable. */
export const ORDERS_PER_ROUND = 3

/**
 * One round transition: dispose last round's order subscriptions, clear
 * last round's orders, bump the round counter, generate this round's
 * orders, insert each, and (optionally) subscribe to its 是否接受 cell.
 *
 * The `onOrderAccepted` callback fires once per order when the player
 * clicks the 是否接受 cell — receives the order and the chosen boolean.
 */
export async function advanceRound(
    client: Client,
    blockIds: BlockIds,
    onOrderAccepted?: (order: GeneratedOrder, accepted: boolean) => void
): Promise<{round: number; orders: readonly GeneratedOrder[]}> {
    // Per round: ONE handleTransaction, and the craft holds zero state
    // of its own — every quantity we need (current round, current
    // orderStatus rowCnt, current orderContribution rowCnt) is read
    // straight from the engine's block cells. If the iframe reloads
    // mid-game the next click recovers correctly from whatever the
    // workbook holds.
    //
    // What stays out of this tx: per-order accept listeners. Those are
    // observer setup, not a workbook mutation, so they're attached
    // after the tx lands. The accept toggle itself (user clicking
    // 是否接受) gets its own temp:true tx via insertOrderConfig /
    // removeOrderConfig — that's user interaction, not part of round
    // advancement.
    orderAcceptListeners.clear()

    const mainSheetIdx = SHEET_IDX[MAIN_SHEET]
    const engineSheetIdx = SHEET_IDX[ENGINE_SHEET]

    // Discard any active temp branch first so all reads + the round tx
    // see the same canonical state. Without this, getBlockInfo reads
    // through temp-branch state (e.g. orderContribution rows that an
    // accept-order click added on top), but our temp:false tx below
    // would auto-clean the temp branch before applying — payloads
    // sized to the pre-clean view then target rows that no longer
    // exist. cleanTempStatus is housekeeping (not a payload tx) so
    // the "one tx per round" rule still holds.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wb = client as any
    if (typeof wb.cleanTempStatus === 'function') {
        await wb.cleanTempStatus()
    }

    const mainSheetId = await client.getSheetId({sheetIdx: mainSheetIdx})
    if (isErrorMessage(mainSheetId))
        throw new Error(`getSheetId(MAIN) failed: ${JSON.stringify(mainSheetId)}`)
    const engineSheetId = await client.getSheetId({sheetIdx: engineSheetIdx})
    if (isErrorMessage(engineSheetId))
        throw new Error(
            `getSheetId(ENGINE) failed: ${JSON.stringify(engineSheetId)}`
        )

    const [orderStatusInfo, orderContribInfo, constantsInfo] = await Promise.all(
        [
            client.getBlockInfo({
                sheetId: mainSheetId,
                blockId: blockIds.orderStatus,
            }),
            client.getBlockInfo({
                sheetId: mainSheetId,
                blockId: blockIds.orderContribution,
            }),
            client.getBlockInfo({
                sheetId: engineSheetId,
                blockId: blockIds.constants,
            }),
        ]
    )
    if (isErrorMessage(orderStatusInfo))
        throw new Error(
            `getBlockInfo(orderStatus) failed: ${JSON.stringify(orderStatusInfo)}`
        )
    if (isErrorMessage(orderContribInfo))
        throw new Error(
            `getBlockInfo(orderContribution) failed: ${JSON.stringify(
                orderContribInfo
            )}`
        )
    if (isErrorMessage(constantsInfo))
        throw new Error(
            `getBlockInfo(constants) failed: ${JSON.stringify(constantsInfo)}`
        )

    // Pull current round directly from the constants block's `round`
    // value cell — no JS-side counter, no readBlockRef (which would
    // submit its own ephemeral-cell tx and break the one-tx
    // invariant).
    const roundRowIdx = CONSTANTS_TABLE.keys.indexOf('round')
    const roundValueColIdx = CONSTANTS_TABLE.fields.findIndex(
        (f) => f.name === 'value'
    )
    const roundCell =
        constantsInfo.cells[roundRowIdx * constantsInfo.colCnt + roundValueColIdx]
    const currentRound =
        roundCell?.value && roundCell.value !== 'empty'
            ? roundCell.value.type === 'number'
                ? roundCell.value.value
                : roundCell.value.type === 'str'
                ? Number(roundCell.value.value)
                : NaN
            : NaN
    const nextRound = (Number.isFinite(currentRound) ? currentRound : 0) + 1

    const orderStatusRowCntBefore = orderStatusInfo.rowCnt
    const orderContribRowCntBefore = orderContribInfo.rowCnt
    const orderStatusRowCntAfter = ORDERS_PER_ROUND
    const orderContribRowCntAfter = 1
    const orderStatusDelta = orderStatusRowCntAfter - orderStatusRowCntBefore
    const orderContribDelta = orderContribRowCntAfter - orderContribRowCntBefore

    const payloads: EditPayload[] = []

    // (1) Sheet-level row adjustment ahead of block ops. If the block
    // is going to gain rows this round we make room first (insertRows
    // pushes downstream blocks down); if it'll lose rows we reclaim
    // those sheet rows (deleteRows). When delta == 0 we don't touch
    // sheet rows at all. orderStatus runs first so orderContribution
    // does its math against the post-orderStatus-shift positions.
    appendSheetRowAdjustment(
        payloads,
        mainSheetIdx,
        orderStatusInfo.rowStart,
        orderStatusRowCntBefore,
        orderStatusRowCntAfter
    )
    // orderContribution sits below orderStatus on the sheet, so after
    // an orderStatus growth its rowStart shifts by orderStatusDelta.
    const orderContribRowStartAdjusted = orderContribInfo.rowStart + orderStatusDelta
    appendSheetRowAdjustment(
        payloads,
        mainSheetIdx,
        orderContribRowStartAdjusted,
        orderContribRowCntBefore,
        orderContribRowCntAfter
    )

    // (2) Wipe both blocks (delete extra rows + clear row 0 cells).
    appendWipePayloads(
        payloads,
        mainSheetIdx,
        blockIds.orderStatus,
        orderStatusRowCntBefore,
        ORDER_STATUS_TABLE.fields.length
    )
    appendWipePayloads(
        payloads,
        mainSheetIdx,
        blockIds.orderContribution,
        orderContribRowCntBefore,
        ORDER_CONTRIBUTION_TABLE.fields.length
    )

    // (3) Bump the round counter on the constants table.
    payloads.push({
        type: 'blockInput',
        value: new BlockInputBuilder()
            .sheetIdx(engineSheetIdx)
            .blockId(blockIds.constants)
            .row(roundRowIdx)
            .col(roundValueColIdx)
            .input(String(nextRound))
            .build(),
    })

    // (4) Generate this round's orders and append their insert payloads.
    // After the wipe (within this same tx) orderStatus is back to
    // rowCnt=1 with row 0 cleared, so order 0 reuses row 0 and orders
    // 1..N grow the block one row each.
    const orders: GeneratedOrder[] = []
    for (let i = 0; i < ORDERS_PER_ROUND; i++) {
        const order = generateOrder(nextRound, i)
        orders.push(order)
        appendInsertOrderPayloads(
            payloads,
            mainSheetIdx,
            blockIds.orderStatus,
            order,
            i
        )
    }
    // Silence unused-warning for orderContribDelta even when it's
    // always zero in practice — the value is still computed because
    // the sheet-level adjustment helper consumes it implicitly.
    void orderContribDelta

    const tx = await client.handleTransaction({
        transaction: {payloads, undoable: true, temp: false},
    })
    // handleTransaction returns either an ActionEffect (success or
    // engine-side Err) or — when the host's permission-patch layer
    // rejects the tx pre-flight — an ErrorMessage `{msg, ty}`. Both
    // shapes need to surface as a thrown error so the iframe log
    // card reports the failure instead of silently advancing the
    // game state.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txStatus = (tx as any)?.status
    if (isErrorMessage(tx) || (txStatus && txStatus.type === 'err')) {
        throw new Error(
            `advanceRound transaction failed at round ${currentRound}→${nextRound}: ` +
                JSON.stringify(tx)
        )
    }

    // (5) Wire up per-order accept listeners. Observer setup, not a
    // workbook mutation.
    for (const order of orders) {
        watchOrderAccepted(client, order.orderId, async (accepted) => {
            try {
                if (accepted) {
                    await insertOrderConfig(client, blockIds, order.orderId)
                } else {
                    await removeOrderConfig(client, blockIds, order.orderId)
                }
            } catch (e) {
                console.warn(
                    `OrderConfiguration sync failed for ${order.orderId}:`,
                    e
                )
            }
            onOrderAccepted?.(order, accepted)
        })
    }

    return {round: nextRound, orders}
}

/**
 * Push insertRows / deleteRows onto `out` to balance a block whose
 * row count is about to change from `before` to `after`. The block
 * occupies sheet positions [rowStart, rowStart + before - 1] today;
 * after the round it'll occupy [rowStart, rowStart + after - 1].
 * Grow → push downstream sheet content down. Shrink → reclaim those
 * sheet rows. Zero delta → no payload emitted.
 */
function appendSheetRowAdjustment(
    out: EditPayload[],
    sheetIdx: number,
    rowStart: number,
    before: number,
    after: number
): void {
    const delta = after - before
    if (delta > 0) {
        out.push({
            type: 'insertRows',
            value: new InsertRowsBuilder()
                .sheetIdx(sheetIdx)
                .start(rowStart + before)
                .count(delta)
                .build(),
        })
    } else if (delta < 0) {
        out.push({
            type: 'deleteRows',
            value: new DeleteRowsBuilder()
                .sheetIdx(sheetIdx)
                .start(rowStart + after)
                .count(-delta)
                .build(),
        })
    }
}

/** Append wipe payloads (shrink block to 1 row + clear row 0) to `out`. */
function appendWipePayloads(
    out: EditPayload[],
    sheetIdx: number,
    blockId: number,
    rowCnt: number,
    colCnt: number
): void {
    if (rowCnt > 1) {
        out.push({
            type: 'deleteRowsInBlock',
            value: new DeleteRowsInBlockBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .start(1)
                .cnt(rowCnt - 1)
                .build(),
        })
    }
    for (let c = 0; c < colCnt; c++) {
        out.push({
            type: 'blockInput',
            value: new BlockInputBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .row(0)
                .col(c)
                .input('')
                .build(),
        })
    }
}

/**
 * Append payloads that write `order` into row `targetRow` of the
 * orderStatus block. For targetRow > 0 also emits an insertRowsInBlock
 * to grow the block. Caller must ensure (via prior payloads in the same
 * tx) that the block has at least `targetRow` rows before this call.
 */
function appendInsertOrderPayloads(
    out: EditPayload[],
    sheetIdx: number,
    blockId: number,
    order: GeneratedOrder,
    targetRow: number
): void {
    if (targetRow > 0) {
        out.push({
            type: 'insertRowsInBlock',
            value: new InsertRowsInBlockBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .start(targetRow)
                .cnt(1)
                .build(),
        })
    }
    const valueByName = orderRowValueByField(order)
    ORDER_STATUS_TABLE.fields.forEach((field, colIdx) => {
        const content = field.valueFormula ? '' : valueByName[field.name] ?? ''
        out.push({
            type: 'blockInput',
            value: new BlockInputBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .row(targetRow)
                .col(colIdx)
                .input(content)
                .build(),
        })
    })
}
