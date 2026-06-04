import {
    BindFormSchemaBuilder,
    BlockInputBuilder,
    CreateBlockBuilder,
    CreateSheetBuilder,
    DeleteRowsBuilder,
    DeleteRowsInBlockBuilder,
    EditPayload,
    EphemeralCellInputBuilder,
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
// These are now derived: each line's row pulls its attribute values
// from one of the two per-line level tables (PRODUCTION_LINE_1_LEVELS /
// PRODUCTION_LINE_2_LEVELS) via BLOCKREF, keyed by the row's 等级 cell.
export const FIXED_COST = '固定开销'
export const MAX_PRODUCTION = '最大生产数'
export const PER_UNIT_COST = '每件产品开销'
// Signed adjustment added to the weighted-supplier yield. Positive
// values raise effective yield, negative lower it. Stored as a 0..1
// fraction (e.g. 0.02 = +2%).
export const YIELD_ADJUSTMENT = '良品率影响'

// Upgrade fields added in this revision.
export const LEVEL = '等级'
export const WILL_UPGRADE = '是否升级'
export const UPGRADE_COST = '升级费用'

// Supplier R&D fields added in this revision.
export const ACCUMULATED_SUPPLY = '累计数量'
export const RESEARCH_COUNT = '研发次数'
export const JOINT_RESEARCH = '联合研发'
export const RESEARCH_THRESHOLD = '阈值'
export const RESEARCH_TIER = '阶段'
// Per-supplier book-keeping for "did this supplier already pick a
// project this round?" Used to enforce one-R&D-opportunity-per-round
// counting (re-picks within the same round don't burn an extra
// opportunity).
export const LAST_RESEARCH_ROUND = '上次研发回合'
// Per-round baselines for 良品率 / 单价. Captured at round-advance
// time (= the previous round's committed end-state). The bridge
// always computes new values as `baseline + effect` rather than
// revert-then-apply, so we don't need to remember which option was
// previously picked this round — the cell value itself is the current
// pick, and the baseline is the round's starting point. Whenever the
// player re-picks, the result is just `baseline + new_effect` (no
// accumulation across in-round picks).
export const BASELINE_YIELD = '本期基础良品率'
export const BASELINE_PRICE = '本期基础单价'

// EnumSet id for the joint-research project options. Shared across
// all suppliers (every supplier picks from the same menu); the effect
// of each option is identical regardless of which supplier picks it.
export const RESEARCH_ENUM_ID = 'joint_research_projects'
export const RESEARCH_PRECISION_ID = 'precision'
export const RESEARCH_COST_ID = 'cost'
export const RESEARCH_BALANCED_ID = 'balanced'

// Five-tier ladder thresholds. To kick off the Nth (1-indexed) R&D
// project for a supplier, that supplier's 累计数量 must reach
// RESEARCH_TIER_THRESHOLDS[N-1].
export const RESEARCH_TIER_THRESHOLDS: readonly number[] = [
    50, 150, 300, 500, 800,
] as const

// Per-project effect: (yieldDelta absolute fraction, priceDelta as
// signed fraction of current price). Applied additively to 良品率 and
// multiplicatively to 单价 when the player picks a project.
//
//   精度强化:  +5% yield, price unchanged
//   成本压缩:  yield unchanged, -15% price
//   均衡研发:  +2% yield, -5% price
//
// Yield is clamped to [0, 0.99] after the delta; price is floored at
// 1 to keep arithmetic well-defined.
export interface ResearchEffect {
    readonly yieldDelta: number
    readonly pricePctDelta: number
}
export const RESEARCH_EFFECTS: Record<string, ResearchEffect> = {
    [RESEARCH_PRECISION_ID]: {yieldDelta: 0.05, pricePctDelta: 0},
    [RESEARCH_COST_ID]: {yieldDelta: 0, pricePctDelta: -0.15},
    [RESEARCH_BALANCED_ID]: {yieldDelta: 0.02, pricePctDelta: -0.05},
}

// Contribution-table fields added in this revision.
export const CAPACITY = '本期产能'
export const TOTAL_COST = '所有成本'

export const ORDER_ID = '订单编号'

// Field-level convenience: factory-managed fields. The first field of a
// table acts as the key column (keyIdx=0 in bindFormSchema) and is forced
// uneditable regardless of the flag here; the rest carry their own
// userEditable.
const f = (name: string, userEditable: boolean | string = false): Field => ({
    name,
    userEditable,
})

// Number column shaped for two decimals (e.g. 单价).
const fDecimal = (
    name: string,
    userEditable: boolean | string = false
): Field => ({
    name,
    userEditable,
    fieldType: 'number',
    numFmt: '0.00',
})

// Number column shaped for percent display with two decimals
// (e.g. 良品率). The stored value is still a 0..1 fraction; the format
// string turns it into "85.00%" at render time.
const fPercent = (
    name: string,
    userEditable: boolean | string = false
): Field => ({
    name,
    userEditable,
    fieldType: 'number',
    numFmt: '0.00%',
})

// Enum column. The host's EnumCell widget renders a dropdown of the
// referenced enum-set's variants and writes the selected variant's id
// into the cell. `userEditable` may be `boolean | string` exactly like
// every other field, so callers can gate selection dynamically (e.g.
// the joint-research dropdown opens only when the supplier's 累计数量
// reaches the next R&D-tier threshold).
const fEnum = (
    name: string,
    enumId: string,
    userEditable: boolean | string = true
): Field => ({
    name,
    userEditable,
    fieldType: 'enum',
    enumId,
})

// Boolean column. Rendered by the bool-cell widget as ✅/❌ with a click
// toggle; stored as 1 (true) / 0 (false) / empty (unset). Sets
// `diyRender: true` explicitly so the engine skips painting the raw
// 1/0 underneath the bool widget — must not rely on newGame's
// heuristic alone, since any unintended overwrite of the field render
// info (e.g. an upstream style-only upsert with `diyRender(false)`)
// would silently leave the canvas painting the raw value through the
// transparent widget chrome.
const fBool = (name: string, userEditable: boolean | string = true): Field => ({
    name,
    userEditable,
    fieldType: 'boolean',
    diyRender: true,
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
//
// 研发次数 / 联合研发 are added per-supplier in this revision: the
// player can periodically pick a joint-research project once their
// 累计数量 with the supplier crosses each ladder threshold. See
// RESEARCH_TIER_THRESHOLDS for the unlock curve and RESEARCH_EFFECTS
// for what each project does to the supplier's 良品率 / 单价.
//
// The userEditable formula on 联合研发 gates the dropdown:
//
//   userEditable = OR(
//     -- already picked this round? then allow re-pick (the bridge
//        reverts the old effect before applying the new one, so the
//        diff stays clean and 研发次数 isn't double-counted)
//     #FIELD("上次研发回合") = BLOCKREF("Constants","round","value"),
//     -- otherwise: not at max tier AND the next tier's threshold is met
//     AND(
//       #FIELD("研发次数") < N,
//       BLOCKREF("SupplierAccumulator", #KEY, "累计数量")
//         >= BLOCKREF("ResearchTiers", #FIELD("研发次数")+1, "阈值")
//     )
//   )
//
// Without the OR's left arm, picking once locks the dropdown for the
// rest of the round even though we want re-pick to be possible. With
// it, the same-round re-pick path stays open until the round advances
// (Constants.round increments → left arm's equality breaks → only the
// "next opportunity" rule applies again).
const JOINT_RESEARCH_USER_EDITABLE = (() => {
    const maxTier = RESEARCH_TIER_THRESHOLDS.length
    return (
        `=OR(` +
        `#FIELD("${LAST_RESEARCH_ROUND}")=BLOCKREF("Constants","round","value"),` +
        `AND(` +
        `#FIELD("${RESEARCH_COUNT}")<${maxTier},` +
        `BLOCKREF("SupplierAccumulator",#KEY,"${ACCUMULATED_SUPPLY}")` +
        `>=BLOCKREF("ResearchTiers",#FIELD("${RESEARCH_COUNT}")+1,"${RESEARCH_THRESHOLD}")` +
        `)` +
        `)`
    )
})()

export const SUPPLIER_FIELDS: readonly Field[] = [
    f('供应商'),
    fPercent('良品率'),
    fDecimal('单价'),
    // 研发次数: number, not user-editable from here — only the
    // joint-research bridge writes it. Counts *opportunities used*, not
    // dropdown clicks: re-picking within a round leaves this unchanged.
    {
        name: RESEARCH_COUNT,
        userEditable: false,
        fieldType: 'number',
        numFmt: '0',
    },
    // 上次研发回合: hidden book-keeping. The bridge writes the
    // current round number on every pick; the userEditable formula's
    // left OR arm compares against Constants.round.value to allow
    // re-picks within the same round, and the bridge consults it to
    // decide whether to bump 研发次数 (fresh pick) or leave it
    // (re-pick).
    {
        name: LAST_RESEARCH_ROUND,
        userEditable: false,
        fieldType: 'number',
        numFmt: '0',
    },
    // 本期基础良品率 / 本期基础单价: hidden round-baseline snapshots.
    // Refreshed by advanceRound to the round's committed end-state
    // 良品率 / 单价 BEFORE the new round's picks happen, so the
    // bridge can compute `new = baseline + effect` without having to
    // remember the previously-applied project (it's "previous pick"
    // in the cell itself, see below).
    fPercent(BASELINE_YIELD),
    fDecimal(BASELINE_PRICE),
    // 联合研发: enum dropdown. Selecting a variant fires the
    // joint-research bridge which:
    //   (a) applies the new project's effect to 良品率/单价 directly
    //       from the round's baseline (no revert needed),
    //   (b) bumps 研发次数 only on the round's *first* pick (re-picks
    //       reuse the same opportunity),
    //   (c) stamps 上次研发回合 to mark the slot as used.
    // The cell value KEEPS the picked project's id so the player can
    // see what's currently selected; the visible cell value is also
    // the "what did I pick this round?" record (no separate hidden
    // field). The cell clears at round-advance via the round-wipe
    // step in advanceRound.
    fEnum(JOINT_RESEARCH, RESEARCH_ENUM_ID, JOINT_RESEARCH_USER_EDITABLE),
]

export const CASH = '现金'

// 财务部 — keys for the financial-impact preview (下期财政影响). Each row
// is one bucket of next-round cash/goodwill movement; values are filled
// by the round-advancement logic (TODO) rather than the player.
export const FIN_PRODUCTION_LINE_1_COST = '生产线一支出'
export const FIN_PRODUCTION_LINE_2_COST = '生产线二支出'
export const FIN_OPTICAL_GLASS_COST = '光学玻璃支出'
export const FIN_OPTICAL_GLASS_INVEST = '光学玻璃投资'
export const FIN_EQUATORIAL_MOUNT_COST = '赤道仪支出'
export const FIN_EQUATORIAL_MOUNT_INVEST = '赤道仪投资'
export const FIN_METAL_FITTINGS_COST = '金属配件支出'
export const FIN_METAL_FITTINGS_INVEST = '金属配件投资'
export const FIN_GOODWILL_DELTA = '商誉变化'
export const FIN_ORDER_REVENUE = '订单收入'
export const FIN_ORDER_PENALTY = '订单罚款'
export const FIN_PRODUCTION_LINE_1_UPGRADE = '生产线一升级'
export const FIN_PRODUCTION_LINE_2_UPGRADE = '生产线二升级'

// 财务部 — keys for the overall financial-status table.
export const FUND = '资金'
export const GOODWILL = '商誉'

export type FieldKind = 'string' | 'number' | 'boolean' | 'enum'

export interface Field {
    name: string
    /**
     * Whether the player can edit this column's cells. Accepts two
     * shapes:
     *
     *   - `boolean` — static decision. `false` permanently locks the
     *     field (host UI widgets render read-only and refuse clicks);
     *     `true` always allows. The simple case — use this for fields
     *     whose editability never depends on runtime state.
     *
     *   - `string` — a formula evaluated per cell. Same placeholders
     *     as `valueFormula`: `#FIELD("name")` for sibling cells, `#KEY`
     *     for the row key, and `#PLACEHOLDER` for a reference to the
     *     cell being checked. When the formula evaluates to FALSE the
     *     host UI treats the cell as locked, same as `userEditable:
     *     false`; when it evaluates to TRUE the cell is editable.
     *     Use this when "is this cell editable right now?" depends on
     *     other cells (e.g. lock 是否升级 once 等级 hits the max
     *     level: `'=#FIELD("等级")<3'`).
     *
     * Implementation note: the engine doesn't know about
     * `userEditable` at all. Boolean is enforced by host UI guards
     * synchronously. The string path is implemented entirely in the
     * host: at widget mount, the formula is installed onto a per-cell
     * `ShadowKind::UserEditable` ephemeral via the existing
     * `getShadowCellId` + `EphemeralCellInput` API (same machinery as
     * validation cells); the widget subscribes to that shadow's value
     * and renders disabled when it returns false. Engine just provides
     * the shadow-id namespace and runs the formula.
     */
    userEditable: boolean | string
    // Logical type of this column. Defaults to 'string'.
    fieldType?: FieldKind
    // Excel-style number format string (e.g. '0.00%', '0.00', '#,##0').
    // Only meaningful when fieldType === 'number'. Applied both to the
    // FieldInfo.type.formatter (for validation/parsing) and to the
    // cell's render style (setNumFmt) so the canvas displays it.
    numFmt?: string
    // EnumSet id used when `fieldType === 'enum'`. The host's enum-cell
    // widget looks up the set via `blockManager.enumSetManager.get(id)`
    // and renders a dropdown of its variants. The cell stores the
    // selected variant's id (not its display value).
    enumId?: string
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
    /**
     * Optional validation formula. When set, the block-interface widget
     * runs this expression as a per-cell shadow formula and shows a
     * warning marker when it evaluates to FALSE. Supports the same
     * placeholders as `valueFormula` (#FIELD("name"), #KEY) plus
     * #PLACEHOLDER which substitutes to a reference to the cell itself.
     *
     * Example: `#PLACEHOLDER>=BLOCKREF("OrderStatus",#FIELD("订单"),"良品率")`
     */
    validation?: string
    /**
     * Optional "is this cell editable?" formula. When set, the engine
     * installs the expression onto a `ShadowKind::UserEditable` shadow
     * ephemeral per (cell, row); the host's permission patch reads
     * that shadow's value to decide whether to accept a cellInput /
     * blockInput. Truthy → allow; falsy / error → reject.
     *
     * Supports the same placeholders as `validation`
     * (#FIELD("name"), #KEY, #PLACEHOLDER). Use cases:
     *
     *   - Lock 是否升级 once 等级 hits cap: `=#FIELD("等级")<3`
     *   - Only allow 本期预计良品率 when an order is bound:
     *     `=#FIELD("订单")<>""`
     */
    userEditableFormula?: string
    /**
     * Explicit per-field `diyRender` override forwarded to
     * `upsertFieldRenderInfo`. When `true`, the engine skips painting
     * the cell's value on the canvas — the block-interface widget (✅/❌
     * bool toggle, enum chip, etc.) owns the visual entirely. Leaving
     * this `undefined` falls back to the heuristic in `newGame`
     * (boolean fields auto-true). Set explicitly when the heuristic
     * would otherwise miss (e.g. a string/number field whose widget
     * fully owns its visual).
     */
    diyRender?: boolean
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

// PRODUCTION_LINE_1_LEVELS / PRODUCTION_LINE_2_LEVELS — per-line upgrade
// ladders, bound on the engine sheet. Each row is one level; the four
// stats determine that level's production capability, and 升级费用 is
// the cash cost to step UP from this level to the next (so the top
// level's 升级费用 is unused / 0).
//
// Per-line stats deliberately diverge so the player has a real
// configuration choice:
//
//   一 (精度线) — cheaper, smaller, biased toward yield. Upgrading
//                trades steady cost increases for tighter precision
//                (more 良品率影响, slightly lower per-unit cost).
//                Best for low-volume, high-quality orders.
//
//   二 (产能线) — bigger, costlier, biased toward throughput. Upgrading
//                massively grows 最大生产数 and drops 每件产品开销,
//                but only modestly improves yield. Best for large,
//                forgiving orders.
const PRODUCTION_LINE_LEVEL_FIELDS: readonly Field[] = [
    f(LEVEL),
    fDecimal(FIXED_COST),
    f(MAX_PRODUCTION),
    fDecimal(PER_UNIT_COST),
    fPercent(YIELD_ADJUSTMENT),
    fDecimal(UPGRADE_COST),
]

export const PRODUCTION_LINE_LEVEL_KEYS = ['1', '2', '3'] as const

export const PRODUCTION_LINE_1_LEVELS_TABLE: Table = {
    keys: PRODUCTION_LINE_LEVEL_KEYS,
    fields: PRODUCTION_LINE_LEVEL_FIELDS,
    refName: 'ProductionLine1Levels',
}

export const PRODUCTION_LINE_2_LEVELS_TABLE: Table = {
    keys: PRODUCTION_LINE_LEVEL_KEYS,
    fields: PRODUCTION_LINE_LEVEL_FIELDS,
    refName: 'ProductionLine2Levels',
}

// Numeric seeds for the level ladders. Indices align with
// PRODUCTION_LINE_LEVEL_KEYS (so [0] = level 1, [2] = level 3).
// [fixedCost, maxProduction, perUnitCost, yieldAdj, upgradeCost]
const PRODUCTION_LINE_1_LEVEL_SEEDS: ReadonlyArray<
    [number, number, number, number, number]
> = [
    [1000, 100, 10, 0.02, 2000],
    [1200, 120, 9, 0.04, 4000],
    [1400, 140, 8, 0.06, 0],
]

const PRODUCTION_LINE_2_LEVEL_SEEDS: ReadonlyArray<
    [number, number, number, number, number]
> = [
    [1500, 150, 8, -0.01, 3000],
    [1800, 220, 7, 0.0, 6000],
    [2100, 300, 6, 0.01, 0],
]

// Per-attribute templated formula that pulls the right cell from the
// per-line level table, dispatched by the row's key (一 / 二).
const productionLineAttrFormula = (attrName: string): string =>
    `=IF(#KEY="${PRODUCTION_LINE_1}",` +
    `BLOCKREF("${PRODUCTION_LINE_1_LEVELS_TABLE.refName}",#FIELD("${LEVEL}"),"${attrName}"),` +
    `BLOCKREF("${PRODUCTION_LINE_2_LEVELS_TABLE.refName}",#FIELD("${LEVEL}"),"${attrName}"))`

// PRODUCTION_LINE_TABLE — per-line parameters. One row per physical
// line (一 / 二). The four stat columns are templated formulas that
// follow this row's 等级 cell into the per-line level table; the
// player edits 等级 indirectly through the 是否升级 toggle (consumed
// by the round-advance flow — TODO: wire up the upgrade execution
// step that bumps 等级 + deducts 升级费用 + resets 是否升级).
export const PRODUCTION_LINE_TABLE: Table = {
    keys: [PRODUCTION_LINE_1, PRODUCTION_LINE_2],
    fields: [
        f(PRODUCTION_LINE),
        // 等级: stored number, not user-editable from here — only the
        // round-advance upgrade step writes it.
        {
            name: LEVEL,
            userEditable: false,
            fieldType: 'number',
            numFmt: '0',
        },
        // The four stats are now derived from the level table.
        fFormulaDecimal(FIXED_COST, productionLineAttrFormula(FIXED_COST)),
        fFormulaDecimal(
            MAX_PRODUCTION,
            productionLineAttrFormula(MAX_PRODUCTION)
        ),
        fFormulaDecimal(
            PER_UNIT_COST,
            productionLineAttrFormula(PER_UNIT_COST)
        ),
        fFormulaPercent(
            YIELD_ADJUSTMENT,
            productionLineAttrFormula(YIELD_ADJUSTMENT)
        ),
        // 是否升级: boolean toggle the player flips to request an
        // upgrade this round. Lives at the end of the row so the
        // upgrade-toggle widget sits as a trailing affordance after the
        // numeric stats. `diyRender=true` is auto-applied by newGame's
        // upsertFieldRenderInfo (every boolean field gets it) so the
        // engine doesn't render "1" / "0" behind the ✅/❌ widget.
        //
        // `userEditable` is a formula here — the toggle is only valid
        // while there's a next level to upgrade *to*. With 3 levels
        // total (PRODUCTION_LINE_LEVEL_KEYS = ['1','2','3']), the
        // player can request an upgrade while 等级 < 3; at level 3
        // the formula evaluates FALSE and the BoolCell widget renders
        // as locked (read-only, not-allowed cursor). The host
        // installs this formula on a per-cell UserEditable shadow at
        // widget-mount time (see useEditable hook).
        {
            ...fBool(WILL_UPGRADE),
            userEditable: `=#FIELD("${LEVEL}")<${PRODUCTION_LINE_LEVEL_KEYS.length}`,
        },
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
        f(PRODUCTION_LINE_1, true),
        f(PRODUCTION_LINE_2, true),
        // 本期预计良品率 — player-editable. Validation warns when the
        // value drops below the order's required 良品率 (looked up via
        // BLOCKREF against the OrderStatus row keyed by this row's 订单
        // cell). Block-interface renders the warning marker; commit is
        // still allowed (validation is advisory).
        {
            name: CURRENT_EXPECTED_YIELD_RATE,
            userEditable: true,
            fieldType: 'number',
            numFmt: '0.00%',
            validation: `#PLACEHOLDER>=BLOCKREF("OrderStatus",#FIELD("订单"),"${REQUIRED_YIELD_RATE}")`,
        },
        // 本期交付数 = 生产线一 + 生产线二.
        fFormulaDecimal(
            CURRENT_DELIVERY,
            `=#FIELD("${PRODUCTION_LINE_1}")+#FIELD("${PRODUCTION_LINE_2}")`
        ),
        // 剩余交付数 = 数量 − 已交付数量 − 本期交付数, all sourced from
        // the matching OrderStatus row.
        fFormulaDecimal(
            REMAINING_DELIVERY,
            `=BLOCKREF("OrderStatus",#FIELD("订单"),"${REQUIRED_AMOUNT}")` +
                `-BLOCKREF("OrderStatus",#FIELD("订单"),"已交付数量")` +
                `-#FIELD("${CURRENT_DELIVERY}")`
        ),
    ],
    refName: 'OrderConfiguration',
}

export const NEW_ORDER_STATUS_TABLE: Table = {
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
        // Editable only when the row actually carries an order — sentinel
        // / empty trailing rows should not present a clickable checkbox.
        // `=#FIELD("订单编号")<>""` evaluates per-row at render time and
        // is gated by the host's useEditable hook via the UserEditable
        // shadow (pre-installed in newGame phase 3).
        fBool('是否接受', `=#FIELD("${ORDER_ID}")<>""`),
    ],
    refName: 'NewOrderStatus',
}

// ACCEPTED_ORDER_STATUS_TABLE — accepted orders, parallel shape to
// NEW_ORDER_STATUS_TABLE but with the accept toggle replaced by two
// round-tracking fields:
//   接单回合 — the round number when the player accepted the order
//             (filled by the host when the player ticks 是否接受;
//             not user-editable from here on).
//   剩余期数 — derived: 期数 + 接单回合 − 当前回合. When that drops
//             below 0 the cell displays '订单已完成' instead of a
//             negative number. String-typed because the formula
//             returns either a number or that literal.
export const ACCEPTED_ORDER_STATUS_TABLE: Table = {
    keys: [],
    fields: [
        f(ORDER_ID),
        f(REQUIRED_AMOUNT),
        f('期数'),
        fPercent(REQUIRED_YIELD_RATE),
        fDecimal(UNIT_PRICE),
        fFormulaDecimal(
            '违约罚金',
            `=#FIELD("${UNIT_PRICE}") * #FIELD("${REQUIRED_AMOUNT}") * 0.5`
        ),
        f('接单回合'),
        // 已交付数量 — accumulator. advanceRound adds this row's
        // OrderConfiguration.本期交付数 to this cell at the end of each
        // round. Stored number (not a formula): persisting it lets us
        // recover lifetime delivery total without re-summing history.
        // Number-typed so OrderConfiguration's 剩余交付数 formula
        // (which subtracts via BLOCKREF) gets clean numeric arithmetic.
        {
            name: '已交付数量',
            userEditable: false,
            fieldType: 'number',
            numFmt: '0',
        },
        {
            name: '剩余期数',
            userEditable: false,
            fieldType: 'number',
            numFmt: '0',
            valueFormula:
                `=IF(#FIELD("期数")+#FIELD("接单回合")` +
                `-BLOCKREF("Constants","round","value")<0,` +
                `"订单已完成",` +
                `#FIELD("期数")+#FIELD("接单回合")` +
                `-BLOCKREF("Constants","round","value"))`,
        },
    ],
    refName: 'OrderStatus',
}

// Per-row literal-formula content for the two upgrade buckets. The
// engine's BlockInput executor installs `=…` content as a per-cell
// formula (not as a literal string), so we write these directly into
// the rows we want formula-driven and leave every other row as a plain
// editable number that round-advance accumulation can write to later.
const finImpactUpgradeFormula = (
    line: '一' | '二',
    levelsRef: string
): string =>
    `=IF(BLOCKREF("ProductionLine","${line}","${WILL_UPGRADE}"),` +
    `BLOCKREF("${levelsRef}",BLOCKREF("ProductionLine","${line}","${LEVEL}")-1,"${UPGRADE_COST}"),` +
    `0)`

const FIN_IMPACT_PER_ROW_FORMULA: Record<string, string> = {
    [FIN_PRODUCTION_LINE_1_UPGRADE]: finImpactUpgradeFormula(
        '一',
        'ProductionLine1Levels'
    ),
    [FIN_PRODUCTION_LINE_2_UPGRADE]: finImpactUpgradeFormula(
        '二',
        'ProductionLine2Levels'
    ),
}

// 下期财政影响 — per-bucket preview of next round's cash / goodwill
// movement. Two-column name/value shape mirrors CONSTRAINTS.
export const FINANCIAL_IMPACT_TABLE: Table = {
    keys: [
        FIN_PRODUCTION_LINE_1_COST,
        FIN_PRODUCTION_LINE_2_COST,
        FIN_OPTICAL_GLASS_COST,
        FIN_OPTICAL_GLASS_INVEST,
        FIN_EQUATORIAL_MOUNT_COST,
        FIN_EQUATORIAL_MOUNT_INVEST,
        FIN_METAL_FITTINGS_COST,
        FIN_METAL_FITTINGS_INVEST,
        FIN_GOODWILL_DELTA,
        FIN_ORDER_REVENUE,
        FIN_ORDER_PENALTY,
        FIN_PRODUCTION_LINE_1_UPGRADE,
        FIN_PRODUCTION_LINE_2_UPGRADE,
    ],
    fields: [f('项目'), fDecimal('值')],
    refName: 'FinancialImpact',
}

// 财务状况 — top-line cash + goodwill snapshot.
export const FINANCIAL_STATUS_TABLE: Table = {
    keys: [FUND, GOODWILL],
    fields: [f('项目'), fDecimal('值')],
    refName: 'FinancialStatus',
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

// Engine-sheet shared list of every supplier name. Used as keys for
// the SupplierAccumulator block and as the canonical iteration order
// when advanceRound rolls up per-supplier supply contributions.
export const ALL_SUPPLIER_NAMES: readonly string[] = [
    OPTICAL_GLASS_SUPPLIER_1,
    OPTICAL_GLASS_SUPPLIER_2,
    EQUATORIAL_MOUNT_SUPPLIER_1,
    EQUATORIAL_MOUNT_SUPPLIER_2,
    METAL_FITTINGS_SUPPLIER_1,
    METAL_FITTINGS_SUPPLIER_2,
] as const

// SupplierAccumulator — running total of each supplier's lifetime
// supply quantity. advanceRound reads PRODUCTION_LINE_CONTRIBUTION_TABLE
// (per-line capacity × per-supplier % allocation × per-line 最大生产数)
// and adds the per-round contribution into the matching row.
// The 联合研发 dropdown on each supplier reads this table via
// BLOCKREF to decide when to unlock the next research tier.
export const SUPPLIER_ACCUMULATOR_TABLE: Table = {
    keys: ALL_SUPPLIER_NAMES,
    fields: [
        f('供应商'),
        {
            name: ACCUMULATED_SUPPLY,
            userEditable: false,
            fieldType: 'number',
            numFmt: '0',
        },
    ],
    refName: 'SupplierAccumulator',
}

// ResearchTiers — the unlock ladder. Five rows (one per tier). The
// supplier-table dropdown checks "did this supplier's accumulated
// quantity reach the threshold of the next tier?" via BLOCKREF
// against this table. Thresholds come from RESEARCH_TIER_THRESHOLDS;
// seeded in newGame.
export const RESEARCH_TIERS_TABLE: Table = {
    keys: RESEARCH_TIER_THRESHOLDS.map((_, i) => String(i + 1)),
    fields: [
        f(RESEARCH_TIER),
        {
            name: RESEARCH_THRESHOLD,
            userEditable: false,
            fieldType: 'number',
            numFmt: '0',
        },
    ],
    refName: 'ResearchTiers',
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

/**
 * Push the three-payload bundle that grows a block by `cnt` rows
 * starting at the block-relative index `blockStart`, with `sheetStart`
 * being the corresponding sheet-absolute row index. Emits:
 *   1. insertRows on the sheet — makes room (pushes downstream content down)
 *   2. insertRowsInBlock        — extends the block into the new rows
 *   3. setRowHeight × cnt       — keeps the newly-added rows at the
 *                                  uniform block row height so widgets
 *                                  stay tall enough to display content
 *                                  (otherwise new rows inherit the
 *                                  default ~15-unit height and clip CJK
 *                                  text + interactive controls).
 *
 * Callers should still emit the per-cell blockInput payloads themselves
 * after this — the helper covers the structural shape only.
 */
function appendBlockRowInsert(
    out: EditPayload[],
    sheetIdx: number,
    blockId: number,
    sheetStart: number,
    blockStart: number,
    cnt: number
): void {
    out.push({
        type: 'insertRows',
        value: new InsertRowsBuilder()
            .sheetIdx(sheetIdx)
            .start(sheetStart)
            .count(cnt)
            .build(),
    })
    out.push({
        type: 'insertRowsInBlock',
        value: new InsertRowsInBlockBuilder()
            .sheetIdx(sheetIdx)
            .blockId(blockId)
            .start(blockStart)
            .cnt(cnt)
            .build(),
    })
    for (let i = 0; i < cnt; i++) {
        out.push({
            type: 'setRowHeight',
            value: new SetRowHeightBuilder()
                .sheetIdx(sheetIdx)
                .row(sheetStart + i)
                .height(BLOCK_ROW_HEIGHT)
                .build(),
        })
    }
}

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
    | 'acceptedOrderStatus'
    | 'orderContribution'
    | 'supplierAccumulator'
    | 'researchTiers'
    | 'productionLine1Levels'
    | 'productionLine2Levels'
    | 'productionLine'
    | 'productionLineContribution'
    | 'opticalGlassSuppliers'
    | 'equatorialMountSuppliers'
    | 'metalFittingsSuppliers'
    | 'financialStatus'
    | 'financialImpact'

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
    // Supplier-accumulator + research-tier ladders. Bound before the
    // supplier tables themselves so the supplier rows' `userEditable`
    // formula can BLOCKREF these by name at parse time.
    {
        key: 'supplierAccumulator',
        table: SUPPLIER_ACCUMULATOR_TABLE,
        sheet: ENGINE_SHEET,
    },
    {
        key: 'researchTiers',
        table: RESEARCH_TIERS_TABLE,
        sheet: ENGINE_SHEET,
    },
    // Production-line upgrade ladders. Must bind before PRODUCTION_LINE
    // because that table's attribute formulas BLOCKREF these by name.
    {
        key: 'productionLine1Levels',
        table: PRODUCTION_LINE_1_LEVELS_TABLE,
        sheet: ENGINE_SHEET,
    },
    {
        key: 'productionLine2Levels',
        table: PRODUCTION_LINE_2_LEVELS_TABLE,
        sheet: ENGINE_SHEET,
    },
    // 销售部 — order tables. Binding order matters here: BindFormSchema's
    // parse-time pass resolves `BLOCKREF("OrderStatus", …)` strings into
    // stable (sheet_id, block_id, field_id) ids; if the target block
    // isn't bound yet, the parser silently falls back to treating
    // BLOCKREF as a generic function (→ permanent #NAME? at eval time).
    // OrderConfiguration's 剩余交付数 formula does exactly that lookup
    // against 'OrderStatus' (the acceptedOrderStatus table), so the
    // accepted-status block has to land first. NEW_ORDER_STATUS_TABLE
    // (refName: 'NewOrderStatus') has no inbound BLOCKREFs and can sit
    // anywhere; placing it after acceptedOrderStatus keeps the
    // sales-department layout stack readable.
    {
        key: 'acceptedOrderStatus',
        table: ACCEPTED_ORDER_STATUS_TABLE,
        sheet: SALES_DEPARTMENT,
    },
    {
        key: 'orderContribution',
        table: ORDER_CONTRIBUTION_TABLE,
        sheet: SALES_DEPARTMENT,
    },
    {
        key: 'orderStatus',
        table: NEW_ORDER_STATUS_TABLE,
        sheet: SALES_DEPARTMENT,
    },
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
    // 财务部 — top-line status first, then the per-bucket impact preview.
    // Both stack on MAIN_SHEET like every other domain block.
    {
        key: 'financialStatus',
        table: FINANCIAL_STATUS_TABLE,
        sheet: MAIN_SHEET,
    },
    {
        key: 'financialImpact',
        table: FINANCIAL_IMPACT_TABLE,
        sheet: MAIN_SHEET,
    },
]

/**
 * Initial block height: one row per key for fixed tables, 1 sentinel
 * template row for variable tables. The engine doesn't support rowCnt=0
 * blocks — even creating one and then immediately deleting its only row
 * panics later inside calc_connector with CannotFindIdxInBlock(...). So
 * variable tables keep a permanent row-0 template, and the
 * insert/remove paths treat "rowCnt=1 with row 0 all empty" as the
 * recyclable empty state.
 */
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

/**
 * Resolve UserEditable shadow ids for a batch of cells and produce
 * `ephemeralCellInput` payloads that install the per-cell formula on
 * each shadow. Caller is responsible for committing the returned
 * payloads in a tx (temp:false, undoable:false). Cells must already
 * exist in the engine (the navigator's fetch_cell_id needs to find
 * them) — call this AFTER the block/row create tx commits.
 */
async function buildUserEditableInstallPayloads(
    client: Client,
    sites: ReadonlyArray<{
        sheetIdx: number
        row: number
        col: number
        formula: string
    }>
): Promise<EditPayload[]> {
    const out: EditPayload[] = []
    for (const site of sites) {
        const sid = await client.getShadowCellId({
            sheetIdx: site.sheetIdx,
            rowIdx: site.row,
            colIdx: site.col,
            kind: 'userEditable',
        })
        if (isErrorMessage(sid)) continue
        if (sid.cellId.type !== 'ephemeralCell') continue
        const eid = sid.cellId.value as number
        out.push({
            type: 'ephemeralCellInput',
            value: new EphemeralCellInputBuilder()
                .id(eid)
                .sheetIdx(site.sheetIdx)
                .content(site.formula)
                .build(),
        })
    }
    return out
}

/**
 * Install UserEditable shadows for the specified rows of a block whose
 * schema fields may carry string `userEditable` formulas. Used by
 * dynamic-row paths (e.g. `insertOrder`) so each freshly grown row
 * gets the same shadow-backed editability as initial newGame rows.
 *
 * `absoluteRows` are sheet-absolute (already added to block masterRow).
 */
export async function installUserEditableShadowsForRows(
    client: Client,
    sheetIdx: number,
    fields: readonly Field[],
    absoluteRows: readonly number[]
): Promise<void> {
    const sites: Array<{
        sheetIdx: number
        row: number
        col: number
        formula: string
    }> = []
    fields.forEach((field, fieldIdx) => {
        // Mirror newGame's policy: key column (fieldIdx === 0) is
        // forced-uneditable regardless of declaration.
        if (fieldIdx === 0) return
        const ue = field.userEditable
        if (typeof ue !== 'string') return
        const formula = ue.trim()
        if (!formula) return
        const normalized = formula.startsWith('=') ? formula : `=${formula}`
        for (const row of absoluteRows) {
            sites.push({sheetIdx, row, col: fieldIdx, formula: normalized})
        }
    })
    if (sites.length === 0) return
    const payloads = await buildUserEditableInstallPayloads(client, sites)
    if (payloads.length === 0) return
    const tx = await client.handleTransaction({
        transaction: {payloads, undoable: false, temp: false},
    })
    if (isErrorMessage(tx))
        throw new Error(
            `userEditable shadow install failed: ${JSON.stringify(tx)}`
        )
}

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

    // Register the shared joint-research enum set so every supplier
    // table's 联合研发 column can dropdown into the same variant list.
    // Idempotent — `set` overwrites by id, safe to call across
    // new-game retries within one iframe session.
    blockManager.enumSetManager.set(
        RESEARCH_ENUM_ID,
        '联合研发项目',
        [
            {
                id: RESEARCH_PRECISION_ID,
                value: '精度强化',
                color: '#22c55e',
            },
            {
                id: RESEARCH_COST_ID,
                value: '成本压缩',
                color: '#f59e0b',
            },
            {
                id: RESEARCH_BALANCED_ID,
                value: '均衡研发',
                color: '#3b82f6',
            },
        ],
        "Pick one per R&D tier. Each option permanently shifts the supplier's 良品率 and 单价."
    )

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
    // Sites that need a userEditable shadow installed in phase 3,
    // after blockTx commits and the navigator can resolve their
    // cell coordinates. One entry per (block-row × formula-field).
    // We can't preallocate ids here because `getShadowCellId` only
    // works once the cell physically exists in the navigator.
    const userEditableSites: Array<{
        sheetIdx: number
        row: number
        col: number
        formula: string
    }> = []
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
            const validation = field.validation ?? ''
            const fieldTypeSpec =
                fieldKind === 'number'
                    ? {type: 'number', validation, formatter: numFmt}
                    : fieldKind === 'boolean'
                    ? {type: 'boolean'}
                    : fieldKind === 'enum'
                    ? {type: 'enum', id: field.enumId ?? ''}
                    : {type: 'string', validation}

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
                // Hint copy of the userEditable formula — the engine
                // owns the authoritative evaluation via the per-cell
                // shadow installed at BindFormSchema time. We carry it
                // here so the host permission patch can shortcut when
                // the field has no dynamic rule.
                userEditableFormula: field.userEditableFormula,
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

        // Key values FIRST, before BindFormSchema. The schema bind's
        // auto-materialize pass parses templated formulas and substitutes
        // `#KEY` with the current value of the row's key cell — that
        // substitution is baked into the AST and never re-runs. If we
        // wrote keys after the bind, every templated `#KEY` would resolve
        // to "" and stay that way forever (verified with the
        // ProductionLine table's per-row IF(#KEY="一", …) formulas).
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

        // Collect userEditable-formula install sites. fields[0] is the
        // forced-uneditable key column (see renderIds loop above) — skip
        // it even if the table literal accidentally declares a formula
        // there. We install in phase 3 after blockTx commits.
        fields.forEach((field, fieldIdx) => {
            if (fieldIdx === 0) return
            const ue = field.userEditable
            if (typeof ue !== 'string') return
            const formula = ue.trim()
            if (!formula) return
            for (let r = 0; r < rowCnt; r++) {
                userEditableSites.push({
                    sheetIdx,
                    row: masterRow + r,
                    col: masterCol + fieldIdx,
                    formula: formula.startsWith('=') ? formula : `=${formula}`,
                })
            }
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
            // Per-field `diyRender` wins when explicitly set; otherwise
            // boolean + enum fields auto-true (their widgets paint
            // ✅/❌ or a dropdown chip on top and the engine must skip
            // painting the raw value behind).
            const diyRender =
                fields[fieldIdx]?.diyRender ??
                (fieldKind === 'boolean' || fieldKind === 'enum')
            blockPayloads.push({
                type: 'upsertFieldRenderInfo',
                value: new UpsertFieldRenderInfoBuilder()
                    .renderId(renderId)
                    .diyRender(diyRender)
                    .styleUpdate({setNumFmt: numFmt})
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
            // Baselines mirror the seeded yield / price so the
            // joint-research bridge has a real BASELINE to compute
            // `baseline + effect` against on the round-1 first pick.
            // advanceRound refreshes these to the round's committed
            // end-state at each round-advance.
            const baseYieldCol = fields.findIndex(
                (fi) => fi.name === BASELINE_YIELD
            )
            const basePriceCol = fields.findIndex(
                (fi) => fi.name === BASELINE_PRICE
            )
            // Seed 研发次数 and 上次研发回合 to 0 even though they're
            // logically "untouched" — leaving them blank breaks the
            // userEditable formula: this engine doesn't coerce empty
            // cells to 0 for `#FIELD(…)<5` / `#FIELD(…)+1` /
            // `#FIELD(…)=BLOCKREF(round)`, so blank → false / #VALUE
            // → OR returns false → the dropdown never unlocks even
            // when 累计 is well past every threshold.
            const researchCountCol = fields.findIndex(
                (fi) => fi.name === RESEARCH_COUNT
            )
            const lastRoundCol = fields.findIndex(
                (fi) => fi.name === LAST_RESEARCH_ROUND
            )

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
                writeCell(baseYieldCol, rolled.yieldRate)
                writeCell(basePriceCol, rolled.unitPrice)
                writeCell(researchCountCol, 0)
                writeCell(lastRoundCol, 0)
            })
        }

        // Production-line parameter table: seed 等级 = 1 and leave
        // 是否升级 blank. The four stat columns are templated formulas
        // that BLOCKREF the level table, so the engine fills them in
        // automatically — no need to write fixed/max/perUnit/yieldAdj
        // here anymore.
        if (table === PRODUCTION_LINE_TABLE) {
            const levelCol = fields.findIndex((fi) => fi.name === LEVEL)
            keys.forEach((_keyName, rowIdx) => {
                if (levelCol < 0) return
                blockPayloads.push({
                    type: 'blockInput',
                    value: new BlockInputBuilder()
                        .sheetIdx(sheetIdx)
                        .blockId(blockId)
                        .row(rowIdx)
                        .col(levelCol)
                        .input('1')
                        .build(),
                })
            })
        }

        // Production-line level tables: seed every level's stats.
        const levelSeeds =
            table === PRODUCTION_LINE_1_LEVELS_TABLE
                ? PRODUCTION_LINE_1_LEVEL_SEEDS
                : table === PRODUCTION_LINE_2_LEVELS_TABLE
                ? PRODUCTION_LINE_2_LEVEL_SEEDS
                : null
        if (levelSeeds) {
            const colOf = (name: string) =>
                fields.findIndex((fi) => fi.name === name)
            const fixedCol = colOf(FIXED_COST)
            const maxCol = colOf(MAX_PRODUCTION)
            const perUnitCol = colOf(PER_UNIT_COST)
            const yieldAdjCol = colOf(YIELD_ADJUSTMENT)
            const upgradeCol = colOf(UPGRADE_COST)
            keys.forEach((_keyName, rowIdx) => {
                const d = levelSeeds[rowIdx]
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
                writeCell(upgradeCol, d[4])
            })
        }

        // Supplier accumulator: seed every row's 累计数量 to 0 so
        // BLOCKREF lookups (from the supplier-table 联合研发 userEditable
        // formula) return a real number instead of blank. advanceRound
        // adds to these each round.
        if (table === SUPPLIER_ACCUMULATOR_TABLE) {
            const accCol = fields.findIndex(
                (fi) => fi.name === ACCUMULATED_SUPPLY
            )
            if (accCol >= 0) {
                keys.forEach((_keyName, rowIdx) => {
                    blockPayloads.push({
                        type: 'blockInput',
                        value: new BlockInputBuilder()
                            .sheetIdx(sheetIdx)
                            .blockId(blockId)
                            .row(rowIdx)
                            .col(accCol)
                            .input('0')
                            .build(),
                    })
                })
            }
        }

        // Research tiers: seed each row's 阈值 from
        // RESEARCH_TIER_THRESHOLDS so the joint-research userEditable
        // formula can look up "what's the threshold for the next
        // research opportunity?" via BLOCKREF.
        if (table === RESEARCH_TIERS_TABLE) {
            const threshCol = fields.findIndex(
                (fi) => fi.name === RESEARCH_THRESHOLD
            )
            if (threshCol >= 0) {
                keys.forEach((_keyName, rowIdx) => {
                    const v = RESEARCH_TIER_THRESHOLDS[rowIdx]
                    if (v === undefined) return
                    blockPayloads.push({
                        type: 'blockInput',
                        value: new BlockInputBuilder()
                            .sheetIdx(sheetIdx)
                            .blockId(blockId)
                            .row(rowIdx)
                            .col(threshCol)
                            .input(String(v))
                            .build(),
                    })
                })
            }
        }

        // Supplier tables: seed 研发次数 + 上次研发回合 to 0 so the
        // userEditable formula's `<5` check and the bridge's re-pick
        // detection both have a numeric operand from the start.
        // 上次研发选项 is left empty (no prior pick to revert).
        if (
            table === OPTICAL_GLASS_SUPPLIERS_TABLE ||
            table === EQUATORIAL_MOUNT_SUPPLIERS_TABLE ||
            table === METAL_FITTINGS_SUPPLIERS_TABLE
        ) {
            const researchCountCol = fields.findIndex(
                (fi) => fi.name === RESEARCH_COUNT
            )
            const lastRoundCol = fields.findIndex(
                (fi) => fi.name === LAST_RESEARCH_ROUND
            )
            keys.forEach((_keyName, rowIdx) => {
                if (researchCountCol >= 0) {
                    blockPayloads.push({
                        type: 'blockInput',
                        value: new BlockInputBuilder()
                            .sheetIdx(sheetIdx)
                            .blockId(blockId)
                            .row(rowIdx)
                            .col(researchCountCol)
                            .input('0')
                            .build(),
                    })
                }
                if (lastRoundCol >= 0) {
                    blockPayloads.push({
                        type: 'blockInput',
                        value: new BlockInputBuilder()
                            .sheetIdx(sheetIdx)
                            .blockId(blockId)
                            .row(rowIdx)
                            .col(lastRoundCol)
                            .input('0')
                            .build(),
                    })
                }
            })
        }

        // Financial-impact table: a few rows need per-cell formulas
        // (e.g. 生产线一升级 reads the upgrade cost from the level table
        // gated by 是否升级). The engine's BlockInput executor treats
        // `=…` content as a formula on the targeted cell, so we just
        // blockInput the formula text directly. Other rows stay plain
        // numeric cells that the round-advance accumulator writes to.
        if (table === FINANCIAL_IMPACT_TABLE) {
            const valueCol = fields.findIndex((fi) => fi.name === '值')
            if (valueCol >= 0) {
                keys.forEach((keyName, rowIdx) => {
                    const formula = FIN_IMPACT_PER_ROW_FORMULA[keyName]
                    if (!formula) return
                    blockPayloads.push({
                        type: 'blockInput',
                        value: new BlockInputBuilder()
                            .sheetIdx(sheetIdx)
                            .blockId(blockId)
                            .row(rowIdx)
                            .col(valueCol)
                            .input(formula)
                            .build(),
                    })
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

    // Phase 3 — pre-install every userEditable shadow formula in one tx.
    // useEditable on the widget side is read-only: it subscribes to the
    // shadow and reads the cached value. If we don't install here, the
    // first widget mount races (state defaults to pessimistic-false
    // before refresh resolves) and the permission patch reads an `empty`
    // shadow → falls through to the owner check → rejects the cellInput.
    // Installing here guarantees the shadow has a real bool by the time
    // any widget mounts.
    if (userEditableSites.length > 0) {
        const installPayloads = await buildUserEditableInstallPayloads(
            client,
            userEditableSites
        )
        if (installPayloads.length > 0) {
            const installTxResult = await client.handleTransaction({
                transaction: {
                    payloads: installPayloads,
                    undoable: false,
                    temp: false,
                },
            })
            if (isErrorMessage(installTxResult))
                throw new Error(
                    `userEditable shadow install failed: ${JSON.stringify(
                        installTxResult
                    )}`
                )
        }
    }

    // Bind the percent-allocator overlay onto each production-line row's
    // supplier-% pairs. The host renders a +/- badge over each cell that
    // moves percentage between the two suppliers of a material so they
    // always sum to 100%. Three groups per row × two rows = six groups.
    const resolvedBlockIds = blockIds as BlockIds
    registerSupplierPercentAllocators(
        resolvedBlockIds.productionLineContribution
    )

    // Wire the 是否升级 → 等级 bump bridge. Idempotent; safe to call
    // across new-game retries within one iframe session.
    installProductionLineUpgradeBridge(client)

    // Wire the supplier 联合研发 → apply-effect bridge. Same
    // idempotency rules.
    installJointResearchBridge(client)

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

/** One generated order, ready to be written into NEW_ORDER_STATUS_TABLE. */
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
// Inserting an order into NEW_ORDER_STATUS_TABLE
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
 * Write `order` into the next available row of NEW_ORDER_STATUS_TABLE,
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
    const row0Empty = isSentinelRowEmpty(info, NEW_ORDER_STATUS_TABLE)

    const targetRow = row0Empty ? 0 : info.rowCnt
    const payloads: EditPayload[] = []

    if (!row0Empty) {
        appendBlockRowInsert(
            payloads,
            sheetIdx,
            blockId,
            info.rowStart + info.rowCnt,
            info.rowCnt,
            1
        )
    }

    const valueByName = orderRowValueByField(order)
    NEW_ORDER_STATUS_TABLE.fields.forEach((field, colIdx) => {
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

    // Install the freshly-grown row's UserEditable shadows (e.g. the
    // 是否接受 checkbox's `=#FIELD("订单编号")<>""` gate) so the widget
    // can see "editable" the instant it mounts. The shadow needs the
    // cell to exist in the navigator, hence: after the row-insert tx
    // commits.
    const absoluteRow = info.rowStart + (row0Empty ? 0 : info.rowCnt)
    await installUserEditableShadowsForRows(
        client,
        sheetIdx,
        NEW_ORDER_STATUS_TABLE.fields,
        [absoluteRow]
    )
    return targetRow
}

// ============================================================================
// OrderConfiguration: order acceptance → row added/removed in plant table
// ----------------------------------------------------------------------------
// When the player accepts an order we copy its id into the
// ORDER_CONTRIBUTION_TABLE (plant view) so they can plan production lines
// against it; toggling back to "not accepted" drops the corresponding row.
// Same sheet-then-block insertion / deletion dance as NEW_ORDER_STATUS_TABLE.
// ============================================================================

const isCellEmpty = (v: Value | undefined): boolean =>
    v === undefined || v === 'empty' || (v.type === 'str' && v.value === '')

/**
 * "Is the block's sentinel row 0 still empty (no real data)?" — i.e., is
 * it safe to overwrite row 0 instead of growing the block?
 *
 * Naively `info.cells.every(isCellEmpty)` is wrong: templated fields
 * (违约罚金 / 当前回合 / 剩余期数) carry COMPUTED VALUES even on the
 * sentinel row — auto-materialized at BindFormSchema time — so they
 * report as non-empty even when no order has landed. We deliberately
 * skip those columns: only the user-data fields tell us whether a real
 * row has been written.
 */
function isSentinelRowEmpty(
    info: {
        rowCnt: number
        colCnt: number
        cells: ReadonlyArray<{value?: Value}>
    },
    table: Table
): boolean {
    if (info.rowCnt !== 1) return false
    for (let colIdx = 0; colIdx < table.fields.length; colIdx++) {
        if (table.fields[colIdx]?.valueFormula) continue // skip templated
        const cell = info.cells[colIdx]
        if (!isCellEmpty(cell?.value)) return false
    }
    return true
}

function cellValueAsString(v: Value | undefined): string {
    if (v === undefined || v === 'empty') return ''
    if (v.type === 'str') return v.value
    if (v.type === 'number') return String(v.value)
    if (v.type === 'bool') return v.value ? '1' : '0'
    return ''
}

/** Read a cell's value as a number, or NaN if not numeric / unparseable. */
function numericCellValue(v: Value | undefined): number {
    if (v === undefined || v === 'empty') return 0
    if (v.type === 'number') return v.value
    if (v.type === 'str') {
        const n = Number(v.value)
        return Number.isFinite(n) ? n : NaN
    }
    if (v.type === 'bool') return v.value ? 1 : 0
    return NaN
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

    const row0Empty = isSentinelRowEmpty(info, ORDER_CONTRIBUTION_TABLE)
    const targetRow = row0Empty ? 0 : info.rowCnt
    const payloads: EditPayload[] = []

    if (!row0Empty) {
        appendBlockRowInsert(
            payloads,
            sheetIdx,
            blockId,
            info.rowStart + info.rowCnt,
            info.rowCnt,
            1
        )
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
        // The engine doesn't allow rowCnt=0 blocks, so keep row 0 as a
        // sentinel template — clear its cells instead of deleting it.
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
// AcceptedOrderStatus: mirror accepted orders into ACCEPTED_ORDER_STATUS_TABLE
// ----------------------------------------------------------------------------
// When the player toggles 是否接受 on, we also copy the order's fields
// over to ACCEPTED_ORDER_STATUS_TABLE and stamp 接单回合 with the round
// the acceptance happened. Toggling back to off removes the row again.
// Same sheet-then-block dance as insertOrderConfig; templated fields
// (违约罚金 / 剩余期数) are left blank — the engine materializes them.
// ============================================================================
export async function insertAcceptedOrder(
    client: Client,
    blockIds: BlockIds,
    order: GeneratedOrder,
    acceptedRound: number
): Promise<number> {
    const sheetIdx = SHEET_IDX[MAIN_SHEET]
    const blockId = blockIds.acceptedOrderStatus

    const sheetIdResp = await client.getSheetId({sheetIdx})
    if (isErrorMessage(sheetIdResp))
        throw new Error(`getSheetId failed: ${JSON.stringify(sheetIdResp)}`)
    const info = await client.getBlockInfo({sheetId: sheetIdResp, blockId})
    if (isErrorMessage(info))
        throw new Error(`getBlockInfo failed: ${JSON.stringify(info)}`)

    // Idempotency: if the order is already in the block, no-op. Same
    // rationale as insertOrderConfig — accept toggles can re-fire.
    const idCol = ACCEPTED_ORDER_STATUS_TABLE.fields.findIndex(
        (fi) => fi.name === ORDER_ID
    )
    if (idCol >= 0) {
        for (let r = 0; r < info.rowCnt; r++) {
            const cell = info.cells[r * info.colCnt + idCol]
            if (cell && cellValueAsString(cell.value) === order.orderId)
                return r
        }
    }

    const row0Empty = isSentinelRowEmpty(info, ACCEPTED_ORDER_STATUS_TABLE)
    const targetRow = row0Empty ? 0 : info.rowCnt
    const payloads: EditPayload[] = []

    if (!row0Empty) {
        appendBlockRowInsert(
            payloads,
            sheetIdx,
            blockId,
            info.rowStart + info.rowCnt,
            info.rowCnt,
            1
        )
    }

    // Column → literal value for non-templated fields. 违约罚金 and
    // 剩余期数 are templated (valueFormula) and so are skipped here.
    const valueByName: Record<string, string> = {
        [ORDER_ID]: order.orderId,
        [REQUIRED_AMOUNT]: String(order.amount),
        期数: String(order.deadlineRounds),
        [REQUIRED_YIELD_RATE]: String(order.yieldRate),
        [UNIT_PRICE]: String(order.unitPrice),
        接单回合: String(acceptedRound),
        // 已交付数量 starts at 0 — advanceRound bumps it each round.
        // Writing the literal "0" (vs. leaving blank) keeps the
        // OrderConfiguration.剩余交付数 BLOCKREF arithmetic clean.
        已交付数量: '0',
    }
    ACCEPTED_ORDER_STATUS_TABLE.fields.forEach((field, colIdx) => {
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

    // temp:true — stays on the bool-cell's temp branch, same as
    // insertOrderConfig.
    const tx = await client.handleTransaction({
        transaction: {payloads, undoable: true, temp: true},
    })
    if (isErrorMessage(tx))
        throw new Error(
            `insertAcceptedOrder transaction failed: ${JSON.stringify(tx)}`
        )
    return targetRow
}

export async function removeAcceptedOrder(
    client: Client,
    blockIds: BlockIds,
    orderId: string
): Promise<boolean> {
    const sheetIdx = SHEET_IDX[MAIN_SHEET]
    const blockId = blockIds.acceptedOrderStatus

    const sheetIdResp = await client.getSheetId({sheetIdx})
    if (isErrorMessage(sheetIdResp))
        throw new Error(`getSheetId failed: ${JSON.stringify(sheetIdResp)}`)
    const info = await client.getBlockInfo({sheetId: sheetIdResp, blockId})
    if (isErrorMessage(info))
        throw new Error(`getBlockInfo failed: ${JSON.stringify(info)}`)

    const idCol = ACCEPTED_ORDER_STATUS_TABLE.fields.findIndex(
        (fi) => fi.name === ORDER_ID
    )
    if (idCol < 0) return false

    let targetRow = -1
    for (let r = 0; r < info.rowCnt; r++) {
        const cell = info.cells[r * info.colCnt + idCol]
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
        // Engine forbids rowCnt=0 — keep the sentinel row 0 and just
        // clear its cells.
        ACCEPTED_ORDER_STATUS_TABLE.fields.forEach((_, colIdx) => {
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

    const tx = await client.handleTransaction({
        transaction: {payloads, undoable: true, temp: true},
    })
    if (isErrorMessage(tx))
        throw new Error(
            `removeAcceptedOrder transaction failed: ${JSON.stringify(tx)}`
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
        if (e.refName !== NEW_ORDER_STATUS_TABLE.refName) return
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

// ============================================================================
// ProductionLine 是否升级 toggle → immediate level bump
// ----------------------------------------------------------------------------
// When the player flips 是否升级 ON, we bump that line's 等级 by +1 in
// the same temp branch the bool widget wrote to; flipping it OFF reverts
// the bump. The bump fires through the FINANCIAL_IMPACT_TABLE's templated
// 升级 formulas (which read 是否升级 + 等级 + 升级费用) via dep
// propagation, so the financial preview line shows the cost as soon as
// the toggle commits.
//
// Single bus listener pattern, same shape as ensureOrderAcceptBridge.
// ============================================================================
let _productionLineUpgradeBridgeInstalled = false
export function installProductionLineUpgradeBridge(client: Client): void {
    if (_productionLineUpgradeBridgeInstalled) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onBlockCellEdit = (window as any).onBlockCellEdit as
        | ((cb: (e: BlockCellEditEvent) => void) => () => void)
        | undefined
    if (!onBlockCellEdit) return
    _productionLineUpgradeBridgeInstalled = true

    const levelColIdx = PRODUCTION_LINE_TABLE.fields.findIndex(
        (f) => f.name === LEVEL
    )
    if (levelColIdx < 0) return

    onBlockCellEdit(async (e) => {
        if (e.refName !== PRODUCTION_LINE_TABLE.refName) return
        if (e.fieldName !== WILL_UPGRADE) return

        // Resolve this row's block-relative row index. The edit event
        // carries sheet rowIdx; convert via the block's rowStart.
        const info = await client.getBlockInfo({
            sheetId: e.sheetId,
            blockId: e.blockId,
        })
        if (isErrorMessage(info)) return
        const blockRow = e.rowIdx - info.rowStart
        if (blockRow < 0 || blockRow >= info.rowCnt) return

        // Read the row's current 等级 cell. info.cells is row-major.
        const levelCell =
            info.cells[blockRow * info.colCnt + levelColIdx]?.value
        const currentLevel = numericCellValue(levelCell)
        if (!Number.isFinite(currentLevel)) return

        // Toggle on (newValue === '1') → +1; off → -1.
        const delta = e.newValue === '1' ? 1 : -1
        const newLevel = currentLevel + delta

        // temp:true — sit on the same temp branch the bool widget is
        // committing into, so the level bump is part of the same
        // visible-diff cluster and can be rolled back together if the
        // player discards the round's draft.
        const tx = await client.handleTransaction({
            transaction: {
                payloads: [
                    {
                        type: 'blockInput',
                        value: new BlockInputBuilder()
                            .sheetIdx(e.sheetIdx)
                            .blockId(e.blockId)
                            .row(blockRow)
                            .col(levelColIdx)
                            .input(String(newLevel))
                            .build(),
                    },
                ],
                undoable: true,
                temp: true,
            },
        })
        if (isErrorMessage(tx)) console.warn('upgrade level bump failed:', tx)
    })
}

// ============================================================================
// Supplier 联合研发 enum pick → revert previous + apply new
// ----------------------------------------------------------------------------
// When the player picks a project from a supplier's 联合研发 dropdown,
// this bridge enforces one R&D opportunity per supplier per round AND
// supports re-picking within the same round (changing your mind):
//
//   1. Looks up the picked project's RESEARCH_EFFECTS entry (constant
//      — every supplier sees the same option-to-effect mapping).
//   2. Reads the supplier's current 良品率 / 单价 / 研发次数 /
//      上次研发回合 / 上次研发选项 cells AND the current round number
//      from the Constants block.
//   3. Detects whether this is a *re-pick* (same supplier picked
//      already this round → 上次研发回合 == currentRound) or a *fresh
//      pick* (新的研发机会).
//   4. If re-pick: reverts the previously-applied effect (subtract
//      yieldDelta, divide out the price multiplier) so the new effect
//      lands on the round's BASELINE 良品率/单价 instead of stacking
//      on top of the previous in-round pick. 研发次数 stays as-is.
//   5. Applies the picked project's effect to the (possibly reverted)
//      baseline. 良品率 clamps to [0, 0.99], 单价 floors at 1.
//   6. Bumps 研发次数 ONLY on a fresh pick (so re-picks don't burn an
//      extra opportunity).
//   7. Stamps 上次研发回合 + 上次研发选项 to mark "this round used".
//   8. Resets the 联合研发 cell to empty.
//
// All writes go in one tx so the diff overlay shows the *net* change
// since canonical — picking option A then re-picking B shows only B's
// diff vs canonical, never A's. That's the "更改时把之前的diff去掉"
// guarantee the user asked for: the temp branch's state always
// reflects "baseline + current pick", not "baseline + first pick +
// second pick + …".
//
// Listens on the same `window.onBlockCellEdit` bus as the upgrade
// bridge. Filter by refName (suppliers fan out across three tables) +
// fieldName. Early-returns on `newValue === ''` so the bridge's own
// reset of 联合研发 doesn't re-fire it.
// ============================================================================
const SUPPLIER_TABLE_REFNAMES: ReadonlySet<string> = new Set([
    'OpticalGlassSupplier',
    'EquatorialMountSupplier',
    'MetalFittingsSupplier',
])

let _jointResearchBridgeInstalled = false
export function installJointResearchBridge(client: Client): void {
    if (_jointResearchBridgeInstalled) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onBlockCellEdit = (window as any).onBlockCellEdit as
        | ((cb: (e: BlockCellEditEvent) => void) => () => void)
        | undefined
    if (!onBlockCellEdit) return
    _jointResearchBridgeInstalled = true

    const yieldCol = SUPPLIER_FIELDS.findIndex((f) => f.name === '良品率')
    const priceCol = SUPPLIER_FIELDS.findIndex((f) => f.name === '单价')
    const researchCountCol = SUPPLIER_FIELDS.findIndex(
        (f) => f.name === RESEARCH_COUNT
    )
    const lastRoundCol = SUPPLIER_FIELDS.findIndex(
        (f) => f.name === LAST_RESEARCH_ROUND
    )
    const baselineYieldCol = SUPPLIER_FIELDS.findIndex(
        (f) => f.name === BASELINE_YIELD
    )
    const baselinePriceCol = SUPPLIER_FIELDS.findIndex(
        (f) => f.name === BASELINE_PRICE
    )
    if (
        yieldCol < 0 ||
        priceCol < 0 ||
        researchCountCol < 0 ||
        lastRoundCol < 0 ||
        baselineYieldCol < 0 ||
        baselinePriceCol < 0
    )
        return

    onBlockCellEdit(async (e) => {
        if (!e.refName || !SUPPLIER_TABLE_REFNAMES.has(e.refName)) return
        if (e.fieldName !== JOINT_RESEARCH) return
        // Empty newValue means the bridge itself just reset the cell.
        // Don't recurse.
        if (e.newValue === '') return
        const newEffect = RESEARCH_EFFECTS[e.newValue]
        if (!newEffect) return

        const info = await client.getBlockInfo({
            sheetId: e.sheetId,
            blockId: e.blockId,
        })
        if (isErrorMessage(info)) return
        const blockRow = e.rowIdx - info.rowStart
        if (blockRow < 0 || blockRow >= info.rowCnt) return

        const readCell = (col: number): number => {
            const cell = info.cells[blockRow * info.colCnt + col]
            return numericCellValue(cell?.value)
        }

        // Pull the current round from Constants WITHOUT firing any
        // tx. Critical: `readBlockRef` would evaluate via a
        // `temp: false` ephemeral input — and the engine's "non-temp
        // tx clears the active temp branch" rule would then wipe out
        // any prior in-round picks (this round's other suppliers'
        // dropdown selections + their bridge writes). That's the
        // "can't pick on multiple suppliers" bug. Pure reads via
        // getCellIdByBlockRef + batchGetCellInfoById avoid touching
        // the temp branch at all.
        const roundCellId = await client.getCellIdByBlockRef({
            refName: CONSTANTS_TABLE.refName,
            key: 'round',
            field: 'value',
        })
        if (isErrorMessage(roundCellId)) return
        const cellInfos = await client.batchGetCellInfoById({
            ids: [roundCellId],
        })
        if (isErrorMessage(cellInfos)) return
        const roundValue = cellInfos[0]?.value
        const currentRound =
            roundValue && roundValue !== 'empty' && roundValue.type === 'number'
                ? roundValue.value
                : roundValue &&
                  roundValue !== 'empty' &&
                  roundValue.type === 'str'
                ? Number(roundValue.value)
                : NaN
        if (!Number.isFinite(currentRound)) return

        const curCount = readCell(researchCountCol)
        const lastRound = readCell(lastRoundCol)
        const baselineYield = readCell(baselineYieldCol)
        const baselinePrice = readCell(baselinePriceCol)
        const isRepick =
            Number.isFinite(lastRound) && lastRound === currentRound

        // Apply the picked effect to the round's BASELINE. No
        // revert-needed bookkeeping: the baseline is captured at
        // round-advance from the previous round's committed
        // end-state, so it's always "yield/price at the start of
        // this round". A re-pick within the round is just another
        // `baseline + new_effect` write — the diff overlay then
        // shows only the latest pick's delta vs canonical (no
        // accumulation across in-round re-picks).
        //
        // Bounded — yield clamps to [0, 0.99]; price floors at 1 so
        // downstream arithmetic stays well-defined.
        const newYield = Math.min(
            0.99,
            Math.max(0, baselineYield + newEffect.yieldDelta)
        )
        const newPrice = Math.max(
            1,
            Math.round(baselinePrice * (1 + newEffect.pricePctDelta))
        )

        // 研发次数 counts *opportunities used*, not clicks. A re-pick
        // is the same opportunity — don't increment.
        const newCount = isRepick
            ? curCount
            : (Number.isFinite(curCount) ? curCount : 0) + 1

        const writePayload = (col: number, content: string): EditPayload => ({
            type: 'blockInput',
            value: new BlockInputBuilder()
                .sheetIdx(e.sheetIdx)
                .blockId(e.blockId)
                .row(blockRow)
                .col(col)
                .input(content)
                .build(),
        })

        // All writes in one tx — keeps the diff overlay coherent as a
        // single "research applied" event vs canonical. The 联合研发
        // cell is intentionally NOT touched here: the widget already
        // committed `newValue` into it before emitting onBlockCellEdit,
        // and keeping that value visible doubles as the "what did I
        // pick this round?" UI affordance (no separate hidden field
        // needed). The cell clears at round-advance via the per-round
        // wipe step.
        const tx = await client.handleTransaction({
            transaction: {
                payloads: [
                    writePayload(yieldCol, String(newYield)),
                    writePayload(priceCol, String(newPrice)),
                    writePayload(researchCountCol, String(newCount)),
                    writePayload(lastRoundCol, String(currentRound)),
                ],
                undoable: true,
                temp: true,
            },
        })
        if (isErrorMessage(tx)) console.warn('joint research apply failed:', tx)
    })
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
        NEW_ORDER_STATUS_TABLE.fields.length,
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

    // Commit any active temp branch first. The host runs in temp mode,
    // so the player's accept-toggles (which fan out to insertOrderConfig
    // + insertAcceptedOrder, both temp:true) live on the temp branch.
    // If we ran our non-temp round tx without committing, the engine's
    // "non-temp tx discards any active temp branch" rule would wipe
    // every accepted order before advancing. commitTempStatus folds
    // those edits into canonical state so they survive round advance
    // — and getBlockInfo below sees the same view our payloads target.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wb = client as any
    if (typeof wb.commitTempStatus === 'function') {
        await wb.commitTempStatus()
    }

    const mainSheetId = await client.getSheetId({sheetIdx: mainSheetIdx})
    if (isErrorMessage(mainSheetId))
        throw new Error(
            `getSheetId(MAIN) failed: ${JSON.stringify(mainSheetId)}`
        )
    const engineSheetId = await client.getSheetId({sheetIdx: engineSheetIdx})
    if (isErrorMessage(engineSheetId))
        throw new Error(
            `getSheetId(ENGINE) failed: ${JSON.stringify(engineSheetId)}`
        )

    // orderContribution + acceptedOrderStatus are NOT resized here —
    // accepted orders persist across rounds. We do read them: the
    // accumulator step folds each OrderConfiguration row's 本期交付数
    // (this round's deliveries) into the matching OrderStatus row's
    // 已交付数量 (lifetime delivered total) before bumping the round.
    const [
        orderStatusInfo,
        orderContribInfo,
        acceptedOrderStatusInfo,
        constantsInfo,
        productionLineInfo,
        productionLineContribInfo,
        supplierAccumulatorInfo,
        opticalGlassSuppliersInfo,
        equatorialMountSuppliersInfo,
        metalFittingsSuppliersInfo,
    ] = await Promise.all([
        client.getBlockInfo({
            sheetId: mainSheetId,
            blockId: blockIds.orderStatus,
        }),
        client.getBlockInfo({
            sheetId: mainSheetId,
            blockId: blockIds.orderContribution,
        }),
        client.getBlockInfo({
            sheetId: mainSheetId,
            blockId: blockIds.acceptedOrderStatus,
        }),
        client.getBlockInfo({
            sheetId: engineSheetId,
            blockId: blockIds.constants,
        }),
        client.getBlockInfo({
            sheetId: mainSheetId,
            blockId: blockIds.productionLine,
        }),
        client.getBlockInfo({
            sheetId: mainSheetId,
            blockId: blockIds.productionLineContribution,
        }),
        client.getBlockInfo({
            sheetId: engineSheetId,
            blockId: blockIds.supplierAccumulator,
        }),
        client.getBlockInfo({
            sheetId: mainSheetId,
            blockId: blockIds.opticalGlassSuppliers,
        }),
        client.getBlockInfo({
            sheetId: mainSheetId,
            blockId: blockIds.equatorialMountSuppliers,
        }),
        client.getBlockInfo({
            sheetId: mainSheetId,
            blockId: blockIds.metalFittingsSuppliers,
        }),
    ])
    if (isErrorMessage(orderStatusInfo))
        throw new Error(
            `getBlockInfo(orderStatus) failed: ${JSON.stringify(
                orderStatusInfo
            )}`
        )
    if (isErrorMessage(orderContribInfo))
        throw new Error(
            `getBlockInfo(orderContribution) failed: ${JSON.stringify(
                orderContribInfo
            )}`
        )
    if (isErrorMessage(acceptedOrderStatusInfo))
        throw new Error(
            `getBlockInfo(acceptedOrderStatus) failed: ${JSON.stringify(
                acceptedOrderStatusInfo
            )}`
        )
    if (isErrorMessage(constantsInfo))
        throw new Error(
            `getBlockInfo(constants) failed: ${JSON.stringify(constantsInfo)}`
        )
    if (isErrorMessage(productionLineInfo))
        throw new Error(
            `getBlockInfo(productionLine) failed: ${JSON.stringify(
                productionLineInfo
            )}`
        )
    if (isErrorMessage(productionLineContribInfo))
        throw new Error(
            `getBlockInfo(productionLineContribution) failed: ${JSON.stringify(
                productionLineContribInfo
            )}`
        )
    if (isErrorMessage(supplierAccumulatorInfo))
        throw new Error(
            `getBlockInfo(supplierAccumulator) failed: ${JSON.stringify(
                supplierAccumulatorInfo
            )}`
        )
    if (isErrorMessage(opticalGlassSuppliersInfo))
        throw new Error(
            `getBlockInfo(opticalGlassSuppliers) failed: ${JSON.stringify(
                opticalGlassSuppliersInfo
            )}`
        )
    if (isErrorMessage(equatorialMountSuppliersInfo))
        throw new Error(
            `getBlockInfo(equatorialMountSuppliers) failed: ${JSON.stringify(
                equatorialMountSuppliersInfo
            )}`
        )
    if (isErrorMessage(metalFittingsSuppliersInfo))
        throw new Error(
            `getBlockInfo(metalFittingsSuppliers) failed: ${JSON.stringify(
                metalFittingsSuppliersInfo
            )}`
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
        constantsInfo.cells[
            roundRowIdx * constantsInfo.colCnt + roundValueColIdx
        ]
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
    const orderStatusRowCntAfter = ORDERS_PER_ROUND
    const orderStatusDelta = orderStatusRowCntAfter - orderStatusRowCntBefore

    const payloads: EditPayload[] = []

    // (1) Resize the new-order block to exactly ORDERS_PER_ROUND rows.
    // We don't wipe-and-reinsert anymore — that needed a sentinel
    // template row to anchor row 0 against. With variable-length blocks
    // starting at rowCnt=0, we just emit symmetric sheet+block deltas
    // to grow or shrink, then overwrite the row data in step (3).
    // orderContribution + acceptedOrderStatus are not touched — both
    // hold accepted orders that persist across rounds.
    if (orderStatusDelta > 0) {
        appendBlockRowInsert(
            payloads,
            mainSheetIdx,
            blockIds.orderStatus,
            orderStatusInfo.rowStart + orderStatusRowCntBefore,
            orderStatusRowCntBefore,
            orderStatusDelta
        )
    } else if (orderStatusDelta < 0) {
        payloads.push({
            type: 'deleteRowsInBlock',
            value: new DeleteRowsInBlockBuilder()
                .sheetIdx(mainSheetIdx)
                .blockId(blockIds.orderStatus)
                .start(orderStatusRowCntAfter)
                .cnt(-orderStatusDelta)
                .build(),
        })
        payloads.push({
            type: 'deleteRows',
            value: new DeleteRowsBuilder()
                .sheetIdx(mainSheetIdx)
                .start(orderStatusInfo.rowStart + orderStatusRowCntAfter)
                .count(-orderStatusDelta)
                .build(),
        })
    }

    // (2a) Accumulate this round's deliveries into each accepted order's
    // 已交付数量. Read OrderConfiguration's (订单, 本期交付数) per row,
    // find the matching OrderStatus row by orderId, write
    // new_已交付数量 = old_已交付数量 + 本期交付数. We do this BEFORE
    // bumping the round so the 本期交付数 we read still reflects this
    // round's player input (the formula doesn't depend on `round`, but
    // doing the accumulator first keeps the timeline clear).
    const oc = orderContribInfo
    const acc = acceptedOrderStatusInfo
    const ocOrderCol = ORDER_CONTRIBUTION_TABLE.fields.findIndex(
        (fi) => fi.name === '订单'
    )
    const ocCurDeliveryCol = ORDER_CONTRIBUTION_TABLE.fields.findIndex(
        (fi) => fi.name === CURRENT_DELIVERY
    )
    const accOrderIdCol = ACCEPTED_ORDER_STATUS_TABLE.fields.findIndex(
        (fi) => fi.name === ORDER_ID
    )
    const accDeliveredCol = ACCEPTED_ORDER_STATUS_TABLE.fields.findIndex(
        (fi) => fi.name === '已交付数量'
    )

    // Build orderId → row index map for the accepted-status block.
    const accRowByOrderId = new Map<string, number>()
    if (accOrderIdCol >= 0) {
        for (let r = 0; r < acc.rowCnt; r++) {
            const cell = acc.cells[r * acc.colCnt + accOrderIdCol]
            const orderId = cellValueAsString(cell?.value)
            if (orderId) accRowByOrderId.set(orderId, r)
        }
    }

    if (ocOrderCol >= 0 && ocCurDeliveryCol >= 0 && accDeliveredCol >= 0) {
        for (let r = 0; r < oc.rowCnt; r++) {
            const orderId = cellValueAsString(
                oc.cells[r * oc.colCnt + ocOrderCol]?.value
            )
            if (!orderId) continue
            const curDelivery = numericCellValue(
                oc.cells[r * oc.colCnt + ocCurDeliveryCol]?.value
            )
            if (!Number.isFinite(curDelivery) || curDelivery === 0) continue
            const accRow = accRowByOrderId.get(orderId)
            if (accRow === undefined) continue
            const prevDelivered = numericCellValue(
                acc.cells[accRow * acc.colCnt + accDeliveredCol]?.value
            )
            const base = Number.isFinite(prevDelivered) ? prevDelivered : 0
            payloads.push({
                type: 'blockInput',
                value: new BlockInputBuilder()
                    .sheetIdx(mainSheetIdx)
                    .blockId(blockIds.acceptedOrderStatus)
                    .row(accRow)
                    .col(accDeliveredCol)
                    .input(String(base + curDelivery))
                    .build(),
            })
        }
    }

    // (2a-bis) Accumulate per-supplier supply for this round.
    //
    // Quantity contributed to supplier S in this round =
    //   Σ over production lines L:
    //     ProductionLine[L].最大生产数
    //       × ProductionLineContribution[L].本期产能
    //       × ProductionLineContribution[L].S_pct
    //
    // 最大生产数 lives in PRODUCTION_LINE_TABLE (it's a templated
    // formula that BLOCKREFs the level table, so reading the cell
    // gets the *computed* current capacity for the line's current
    // 等级). 本期产能 + per-supplier % live in
    // PRODUCTION_LINE_CONTRIBUTION_TABLE. We just multiply through
    // and accumulate into SupplierAccumulator.
    const plMaxProdCol = PRODUCTION_LINE_TABLE.fields.findIndex(
        (fi) => fi.name === MAX_PRODUCTION
    )
    const plcCapacityCol = PRODUCTION_LINE_CONTRIBUTION_TABLE.fields.findIndex(
        (fi) => fi.name === CAPACITY
    )
    const supplierCols: Map<string, number> = new Map(
        ALL_SUPPLIER_NAMES.map((s) => [
            s,
            PRODUCTION_LINE_CONTRIBUTION_TABLE.fields.findIndex(
                (fi) => fi.name === s
            ),
        ])
    )
    const accColIdx = SUPPLIER_ACCUMULATOR_TABLE.fields.findIndex(
        (fi) => fi.name === ACCUMULATED_SUPPLY
    )
    if (
        plMaxProdCol >= 0 &&
        plcCapacityCol >= 0 &&
        accColIdx >= 0 &&
        PRODUCTION_LINE_TABLE.keys.length ===
            PRODUCTION_LINE_CONTRIBUTION_TABLE.keys.length
    ) {
        const perSupplierThisRound: Map<string, number> = new Map(
            ALL_SUPPLIER_NAMES.map((s) => [s, 0])
        )
        const lineRowCnt = PRODUCTION_LINE_TABLE.keys.length
        for (let lineRow = 0; lineRow < lineRowCnt; lineRow++) {
            const maxProd = numericCellValue(
                productionLineInfo.cells[
                    lineRow * productionLineInfo.colCnt + plMaxProdCol
                ]?.value
            )
            const capacity = numericCellValue(
                productionLineContribInfo.cells[
                    lineRow * productionLineContribInfo.colCnt + plcCapacityCol
                ]?.value
            )
            if (!Number.isFinite(maxProd) || !Number.isFinite(capacity))
                continue
            const lineProduction = maxProd * capacity
            for (const [supplier, col] of supplierCols) {
                if (col < 0) continue
                const pct = numericCellValue(
                    productionLineContribInfo.cells[
                        lineRow * productionLineContribInfo.colCnt + col
                    ]?.value
                )
                if (!Number.isFinite(pct) || pct === 0) continue
                perSupplierThisRound.set(
                    supplier,
                    (perSupplierThisRound.get(supplier) ?? 0) +
                        lineProduction * pct
                )
            }
        }
        // Write back into SupplierAccumulator. Iterate the actual
        // accumulator block to find the matching row by current key
        // value — robust to row-reordering.
        const accSupplierCol = SUPPLIER_ACCUMULATOR_TABLE.fields.findIndex(
            (fi) => fi.name === '供应商'
        )
        if (accSupplierCol >= 0) {
            for (let r = 0; r < supplierAccumulatorInfo.rowCnt; r++) {
                const supplierName = cellValueAsString(
                    supplierAccumulatorInfo.cells[
                        r * supplierAccumulatorInfo.colCnt + accSupplierCol
                    ]?.value
                )
                if (!supplierName) continue
                const delta = perSupplierThisRound.get(supplierName) ?? 0
                if (delta === 0) continue
                const prev = numericCellValue(
                    supplierAccumulatorInfo.cells[
                        r * supplierAccumulatorInfo.colCnt + accColIdx
                    ]?.value
                )
                const base = Number.isFinite(prev) ? prev : 0
                payloads.push({
                    type: 'blockInput',
                    value: new BlockInputBuilder()
                        .sheetIdx(engineSheetIdx)
                        .blockId(blockIds.supplierAccumulator)
                        .row(r)
                        .col(accColIdx)
                        .input(String(Math.round(base + delta)))
                        .build(),
                })
            }
        }
    }

    // (2b) Bump the round counter on the constants table.
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

    // (2c) Clear last round's per-round player inputs so the next round
    // starts with a clean slate. Two surfaces:
    //
    //   - OrderConfiguration: 生产线一, 生产线二, 本期预计良品率 (the
    //     player's per-order production allocation and the quality
    //     target). Templated columns (本期交付数 / 剩余交付数) are
    //     left alone — they auto-recompute from the cleared inputs.
    //   - ProductionLine: 是否升级 toggle. The round-advance tx is the
    //     "apply" point — we've already accumulated 等级 via the
    //     bridge when the user toggled, so we reset the toggle back to
    //     empty (the next round's "do I want to upgrade?" decision is
    //     made fresh).
    //
    // IMPORTANT: callback bridges (`watchOrderAccepted` for 是否接受,
    // `installProductionLineUpgradeBridge` for 是否升级) listen on
    // `window.onBlockCellEdit`, which is fired only by the host's
    // block-interface widgets when the player clicks them — NOT when
    // the craft sends `blockInput` payloads directly through the
    // workbook client. So these wipe payloads are silent: writing ''
    // to 是否升级 here does *not* re-trigger the upgrade bridge (which
    // would otherwise decrement 等级 on every round-advance and undo
    // the upgrade just applied).
    const ocOrderColForWipe = ORDER_CONTRIBUTION_TABLE.fields.findIndex(
        (fi) => fi.name === '订单'
    )
    void ocOrderColForWipe // only used to assert the table shape — not a target
    const ocLine1Col = ORDER_CONTRIBUTION_TABLE.fields.findIndex(
        (fi) => fi.name === PRODUCTION_LINE_1
    )
    const ocLine2Col = ORDER_CONTRIBUTION_TABLE.fields.findIndex(
        (fi) => fi.name === PRODUCTION_LINE_2
    )
    const ocYieldCol = ORDER_CONTRIBUTION_TABLE.fields.findIndex(
        (fi) => fi.name === CURRENT_EXPECTED_YIELD_RATE
    )
    for (let r = 0; r < orderContribInfo.rowCnt; r++) {
        const wipeCols = [ocLine1Col, ocLine2Col, ocYieldCol].filter(
            (c) => c >= 0
        )
        for (const c of wipeCols) {
            payloads.push({
                type: 'blockInput',
                value: new BlockInputBuilder()
                    .sheetIdx(mainSheetIdx)
                    .blockId(blockIds.orderContribution)
                    .row(r)
                    .col(c)
                    .input('')
                    .build(),
            })
        }
    }
    const plWillUpgradeCol = PRODUCTION_LINE_TABLE.fields.findIndex(
        (fi) => fi.name === WILL_UPGRADE
    )
    if (plWillUpgradeCol >= 0) {
        for (let r = 0; r < PRODUCTION_LINE_TABLE.keys.length; r++) {
            payloads.push({
                type: 'blockInput',
                value: new BlockInputBuilder()
                    .sheetIdx(mainSheetIdx)
                    .blockId(blockIds.productionLine)
                    .row(r)
                    .col(plWillUpgradeCol)
                    .input('')
                    .build(),
            })
        }
    }

    // Supplier 联合研发: clear the dropdown (the player's pick for
    // the just-ended round has already been applied via the bridge
    // and committed; the cell value was kept visible as a "what did I
    // pick this round?" affordance and now resets for the next
    // round). ALSO refresh 本期基础良品率 / 本期基础单价 to the
    // currently-committed 良品率 / 单价 — this snapshots the round's
    // end-state as the next round's baseline, so the bridge's
    // `baseline + effect` formula computes against fresh ground.
    const supYieldCol = SUPPLIER_FIELDS.findIndex((fi) => fi.name === '良品率')
    const supPriceCol = SUPPLIER_FIELDS.findIndex((fi) => fi.name === '单价')
    const supJointCol = SUPPLIER_FIELDS.findIndex(
        (fi) => fi.name === JOINT_RESEARCH
    )
    const supBaseYieldCol = SUPPLIER_FIELDS.findIndex(
        (fi) => fi.name === BASELINE_YIELD
    )
    const supBasePriceCol = SUPPLIER_FIELDS.findIndex(
        (fi) => fi.name === BASELINE_PRICE
    )
    const supplierBlocks: ReadonlyArray<{
        blockId: number
        info: typeof opticalGlassSuppliersInfo
    }> = [
        {
            blockId: blockIds.opticalGlassSuppliers,
            info: opticalGlassSuppliersInfo,
        },
        {
            blockId: blockIds.equatorialMountSuppliers,
            info: equatorialMountSuppliersInfo,
        },
        {
            blockId: blockIds.metalFittingsSuppliers,
            info: metalFittingsSuppliersInfo,
        },
    ]
    if (
        supYieldCol >= 0 &&
        supPriceCol >= 0 &&
        supJointCol >= 0 &&
        supBaseYieldCol >= 0 &&
        supBasePriceCol >= 0
    ) {
        for (const {blockId: supBlockId, info: supInfo} of supplierBlocks) {
            for (let r = 0; r < supInfo.rowCnt; r++) {
                const curYield = numericCellValue(
                    supInfo.cells[r * supInfo.colCnt + supYieldCol]?.value
                )
                const curPrice = numericCellValue(
                    supInfo.cells[r * supInfo.colCnt + supPriceCol]?.value
                )
                const writes: Array<[number, string]> = [[supJointCol, '']]
                if (Number.isFinite(curYield))
                    writes.push([supBaseYieldCol, String(curYield)])
                if (Number.isFinite(curPrice))
                    writes.push([supBasePriceCol, String(curPrice)])
                for (const [col, content] of writes) {
                    payloads.push({
                        type: 'blockInput',
                        value: new BlockInputBuilder()
                            .sheetIdx(mainSheetIdx)
                            .blockId(supBlockId)
                            .row(r)
                            .col(col)
                            .input(content)
                            .build(),
                    })
                }
            }
        }
    }

    // (3) Overwrite every row of orderStatus with this round's freshly
    // generated orders. The block is already sized to ORDERS_PER_ROUND
    // after step (1), so we just blockInput each cell in place.
    // Templated fields (违约罚金) are auto-materialized by the engine
    // — blockInput on a templated cell is treated as a no-op write and
    // the formula re-evaluates from the new sibling-cell values.
    const orders: GeneratedOrder[] = []
    for (let i = 0; i < ORDERS_PER_ROUND; i++) {
        const order = generateOrder(nextRound, i)
        orders.push(order)
        const valueByName = orderRowValueByField(order)
        NEW_ORDER_STATUS_TABLE.fields.forEach((field, colIdx) => {
            const content = field.valueFormula
                ? ''
                : valueByName[field.name] ?? ''
            payloads.push({
                type: 'blockInput',
                value: new BlockInputBuilder()
                    .sheetIdx(mainSheetIdx)
                    .blockId(blockIds.orderStatus)
                    .row(i)
                    .col(colIdx)
                    .input(content)
                    .build(),
            })
        })
    }
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
                    // Mirror into ACCEPTED_ORDER_STATUS_TABLE with the
                    // round of acceptance stamped in 接单回合.
                    await insertAcceptedOrder(
                        client,
                        blockIds,
                        order,
                        nextRound
                    )
                } else {
                    // Unaccept (within the same round, before
                    // advanceRound is called). Remove from BOTH the
                    // plant view and the accepted-orders ledger so the
                    // toggle is fully reversible while the order is
                    // still in the "new" list.
                    await removeOrderConfig(client, blockIds, order.orderId)
                    await removeAcceptedOrder(client, blockIds, order.orderId)
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
