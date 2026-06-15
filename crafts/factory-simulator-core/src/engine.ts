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
    UpsertFieldFormulasBuilder,
    UpsertFieldRenderInfoBuilder,
    acquireCraftCalc,
    isErrorMessage,
} from 'logisheets-web'
import type {Client, CraftCalc, Value} from 'logisheets-web'
import {
    computeFinancialRollup,
    computeSupplierAccumulatorDeltas,
    clampGoodwill,
    evaluateEndgame,
    type FinancialImpactRow,
    type LineContribution,
    type GameState,
} from './round'
import type {Locale} from './locale'
export type {GameState} from './round'

// Engine factory. All previously-top-level state is now scoped inside
// this function so we can close over a `Locale` and parameterize every
// user-visible Chinese string. The function returns the public surface
// — every name that was previously `export const` / `export function`
// is included on the return object so consumers can re-export them
// from their own locale-specific entry points.
export function createEngine(L: Locale) {
// Sheet
const ENGINE_SHEET = 'ENGINE'
// All non-engine blocks (sales / plant / procurement tables) stack on this
// single sheet. The previous per-domain sheets (SALES_DEPARTMENT, PLANT,
// PROCUREMENT) were merged — keep the constants pointing at MAIN_SHEET so
// any external callers that reference them by name still resolve.
const MAIN_SHEET = 'MAIN'
const SALES_DEPARTMENT = MAIN_SHEET
const PLANT = MAIN_SHEET
const PROCUREMENT = MAIN_SHEET

const OPTICAL_GLASS_SUPPLIER_1 = L.suppliers.opticalGlass1
const OPTICAL_GLASS_SUPPLIER_2 = L.suppliers.opticalGlass2

const EQUATORIAL_MOUNT_SUPPLIER_1 = L.suppliers.equatorialMount1
const EQUATORIAL_MOUNT_SUPPLIER_2 = L.suppliers.equatorialMount2

const METAL_FITTINGS_SUPPLIER_1 = L.suppliers.metalFittings1
const METAL_FITTINGS_SUPPLIER_2 = L.suppliers.metalFittings2

const EXPECTED_YIELD_RATE = L.fields.expectedYieldRate
const REQUIRED_YIELD_RATE = L.fields.requiredYieldRate
const CURRENT_EXPECTED_YIELD_RATE = L.fields.currentExpectedYieldRate
const DELIVERED_YIELD_RATE = L.fields.deliveredYieldRate
const DELIVERY_DEADLINE = L.fields.deliveryDeadline
const CURRENT_DELIVERY = L.fields.currentDelivery
const REMAINING_DELIVERY = L.fields.remainingDelivery
// Per-row helper: this order's contribution to this round's revenue =
// 本期交付数 × OrderStatus.单价. Computed inline in
// ORDER_CONTRIBUTION_TABLE so FinancialImpact can sum the column with
// a single BLOCKREFS lookup instead of folding per-row arithmetic.
const CURRENT_REVENUE = L.fields.currentRevenue
// Per-unit penalty stored on each order — rolled at generation time as
// UNIT_PRICE × random integer in [1,3]. Replaces the old flat
// "违约罚金 = 单价 × 数量 × 0.5" formula. Penalty fires per
// undelivered unit, ONLY on the order's deadline round.
const UNIT_PENALTY = L.fields.unitPenalty
// Per-row helper: this order's penalty exposure for THIS round.
// Gated by 剩余期数 == 0 so off-deadline orders contribute 0; on the
// deadline row it's max(0, 剩余交付数) × 单位违约金.
const CURRENT_PENALTY = L.fields.currentPenalty
// Per-row quality penalty: any round you deliver units below the
// order's required 良品率, you pay (gap × 10 × 单价) per delivered
// unit. Gap is in fraction (0.01 = 1 percentage point), so the ×10
// gives the "1% gap → 10% of unit price" rate the design calls for.
// Off-rounds (no delivery / on-spec yield) contribute 0.
const CURRENT_QUALITY_PENALTY = L.fields.currentQualityPenalty
// Per-row helper: this order's goodwill impact for THIS round.
// Same deadline gate as 本期罚款. +1 if fully delivered by deadline,
// −本期罚款/100 if anything left undelivered, 0 otherwise.
const CURRENT_GOODWILL_CHANGE = L.fields.currentGoodwillChange

const REQUIRED_AMOUNT = L.fields.requiredAmount

const UNIT_COST = L.fields.unitCost
const UNIT_PRICE = L.fields.unitPrice

const PRODUCTION_LINE = L.fields.productionLine
const PRODUCTION_LINE_1 = L.fields.productionLine1
const PRODUCTION_LINE_2 = L.fields.productionLine2

// Production-line parameter fields (live in PRODUCTION_LINE_TABLE).
// These are now derived: each line's row pulls its attribute values
// from one of the two per-line level tables (PRODUCTION_LINE_1_LEVELS /
// PRODUCTION_LINE_2_LEVELS) via BLOCKREF, keyed by the row's 等级 cell.
const FIXED_COST = L.fields.fixedCost
const MAX_PRODUCTION = L.fields.maxProduction
const PER_UNIT_COST = L.fields.perUnitCost
// Signed adjustment added to the weighted-supplier yield. Positive
// values raise effective yield, negative lower it. Stored as a 0..1
// fraction (e.g. 0.02 = +2%).
const YIELD_ADJUSTMENT = L.fields.yieldAdjustment

// Upgrade fields added in this revision.
const LEVEL = L.fields.level
const WILL_UPGRADE = L.fields.willUpgrade
const UPGRADE_COST = L.fields.upgradeCost

// Supplier R&D fields added in this revision.
const ACCUMULATED_SUPPLY = L.fields.accumulatedSupply
const RESEARCH_COUNT = L.fields.researchCount
const JOINT_RESEARCH = L.fields.jointResearch
const RESEARCH_THRESHOLD = L.fields.researchThreshold
const RESEARCH_TIER = L.fields.researchTier
// Per-supplier book-keeping for "did this supplier already pick a
// project this round?" Used to enforce one-R&D-opportunity-per-round
// counting (re-picks within the same round don't burn an extra
// opportunity).
const LAST_RESEARCH_ROUND = L.fields.lastResearchRound
// Per-round baselines for 良品率 / 单价. Captured at round-advance
// time (= the previous round's committed end-state). The bridge
// always computes new values as `baseline + effect` rather than
// revert-then-apply, so we don't need to remember which option was
// previously picked this round — the cell value itself is the current
// pick, and the baseline is the round's starting point. Whenever the
// player re-picks, the result is just `baseline + new_effect` (no
// accumulation across in-round picks).
const BASELINE_YIELD = L.fields.baselineYield
const BASELINE_PRICE = L.fields.baselinePrice

// EnumSet id for the joint-research project options. Shared across
// all suppliers (every supplier picks from the same menu); the effect
// of each option is identical regardless of which supplier picks it.
const RESEARCH_ENUM_ID = 'joint_research_projects'
const RESEARCH_PRECISION_ID = 'precision'
const RESEARCH_COST_ID = 'cost'
const RESEARCH_BALANCED_ID = 'balanced'

// Five-tier ladder thresholds. To kick off the Nth (1-indexed) R&D
// project for a supplier, that supplier's 累计数量 must reach
// RESEARCH_TIER_THRESHOLDS[N-1].
const RESEARCH_TIER_THRESHOLDS: readonly number[] = [
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
interface ResearchEffect {
    readonly yieldDelta: number
    readonly pricePctDelta: number
}
// Balance pass: bump research rewards so 联合研发 is a real game
// changer, not a tiny tweak. Each research pick stacks cumulatively
// against the supplier's previous baseline (the yield clamps at 0.99
// per apply, so precision on a premium supplier caps fast and players
// learn to research their CHEAP suppliers where there's room).
const RESEARCH_EFFECTS: Record<string, ResearchEffect> = {
    [RESEARCH_PRECISION_ID]: {yieldDelta: 0.1, pricePctDelta: 0},
    [RESEARCH_COST_ID]: {yieldDelta: 0, pricePctDelta: -0.2},
    [RESEARCH_BALANCED_ID]: {yieldDelta: 0.05, pricePctDelta: -0.1},
}

// Contribution-table fields added in this revision.
const CAPACITY = L.fields.capacity
const TOTAL_COST = L.fields.totalCost

const ORDER_ID = L.fields.orderId

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

const SUPPLIER_FIELDS: readonly Field[] = [
    f(L.fields.supplier),
    fPercent(REQUIRED_YIELD_RATE),
    fDecimal(UNIT_PRICE),
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

const CASH = L.fields.cash

// 财务部 — keys for the financial-impact preview (下期财政影响). Each row
// is one bucket of next-round cash/goodwill movement; values are filled
// by the round-advancement logic (TODO) rather than the player.
const FIN_PRODUCTION_LINE_1_COST = L.finance.productionLine1Cost
const FIN_PRODUCTION_LINE_2_COST = L.finance.productionLine2Cost
const FIN_OPTICAL_GLASS_COST = L.finance.opticalGlassCost
const FIN_EQUATORIAL_MOUNT_COST = L.finance.equatorialMountCost
const FIN_METAL_FITTINGS_COST = L.finance.metalFittingsCost
const FIN_GOODWILL_DELTA = L.finance.goodwillDelta
const FIN_ORDER_REVENUE = L.finance.orderRevenue
const FIN_ORDER_PENALTY = L.finance.orderPenalty
// Continuous quality-gap penalty (per round you deliver under-yield),
// separate from FIN_ORDER_PENALTY (which is the discrete deadline
// failure). Sum of OrderConfiguration's 本期品质罚款 helper.
const FIN_QUALITY_PENALTY = L.finance.qualityPenalty
const FIN_PRODUCTION_LINE_1_UPGRADE = L.finance.productionLine1Upgrade
const FIN_PRODUCTION_LINE_2_UPGRADE = L.finance.productionLine2Upgrade

// 财务部 — keys for the overall financial-status table.
const FUND = L.finance.fund
const GOODWILL = L.finance.goodwill

type FieldKind = 'string' | 'number' | 'boolean' | 'enum'

interface Field {
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
     * Implementation note: the boolean path is enforced by host UI
     * guards synchronously. The string path is handled by the Rust
     * engine — at `BindFormSchema` time the engine auto-installs the
     * formula on a per-cell `ShadowKind::UserEditable` shadow for
     * every row (and on every freshly-inserted row from
     * `InsertRowsInBlock`); the host permission patch reads that
     * shadow's value to gate writes. Engine owns the lifecycle; the
     * craft only declares the template.
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
     * Example: `#PLACEHOLDER>=BLOCKREF("OrderStatus",#FIELD("${L.fields.order}"),"良品率")`
     */
    validation?: string
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

interface Table {
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

// Keys added to Constants for the campaign / win-lose system. Kept
// in this block (vs a separate one) so the round counter + endgame
// state stay co-located and BLOCKREF lookups against them remain
// stable.
const CONST_KEY_CONSECUTIVE_LOSS = L.constKeys.consecutiveLoss
const CONST_KEY_CONSECUTIVE_NO_GOODWILL = L.constKeys.consecutiveNoGoodwill
const CONST_KEY_GAME_STATE = L.constKeys.gameState

const CONSTANTS_TABLE: Table = {
    keys: [
        'seed',
        'round',
        CONST_KEY_CONSECUTIVE_LOSS,
        CONST_KEY_CONSECUTIVE_NO_GOODWILL,
        CONST_KEY_GAME_STATE,
    ],
    fields: [f('type'), f('value')],
    refName: 'Constants',
}

// ============================================================================
// Campaign / endgame parameters
// ----------------------------------------------------------------------------
// 10-round campaign with multi-tier ending. Lose conditions are
// stateful (consecutive rounds), giving the player a grace window
// to recover from a bad streak. Win is evaluated only at the
// MAX_ROUNDS advance; lose can trigger any round.
//
// At baseline (¥5000 seed, ~+850 net/round at default 50/50 supplier
// mix on L1) the player lands ~¥13.5k after 10 rounds — comfortably
// silver, gold needs upgrades + supplier optimisation.
// ============================================================================

const MAX_ROUNDS = 10

// Bankruptcy: lose after N consecutive rounds with negative 资金.
// 2 rounds in a 10-round game ≈ 20% of campaign — tight enough to
// punish reckless play, generous enough to recover from one bad round.
const BANKRUPTCY_GRACE_ROUNDS = 2
// Reputation collapse: lose after N consecutive rounds with 商誉 = 0.
const REPUTATION_GRACE_ROUNDS = 2

// Tier thresholds checked at the MAX_ROUNDS advance, in priority
// order. First tier whose conditions are met wins. Scaled for the
// 10-round campaign: gold ≈ 2.9× baseline net (requires upgrade
// play), silver ≈ 1.1× baseline.
//
// Goodwill thresholds live in the same [0, GOODWILL_MAX=150] range
// the cap enforces and the status-bar pill displays. Starting at
// GOODWILL_BASELINE=100, the player earns +1 per on-time-completed
// order and loses ≈penalty/100 per missed deadline — so reaching
// gold (130) takes near-perfect delivery, silver (100) is "no net
// reputation loss."
// Reputation ceiling that triggers an immediate top-tier win. The
// goodwill cap is GOODWILL_MAX=150, so 150 means "perfect reputation,
// the cap itself" — only reachable with flawless delivery across the
// whole campaign. Fires independently of the round counter; reaching
// this ends the campaign on the spot.
const TIER_ULTIMATE_GOODWILL = 150
const TIER_GOLD_FUND = 40000
const TIER_GOLD_GOODWILL = 130
const TIER_SILVER_FUND = 15000
const TIER_SILVER_GOODWILL = 100

// `GameState` type lives in `./round` (the pure helper module) and is
// re-exported above; the values written to the `游戏状态` cell match
// that union exactly.

const OPTICAL_GLASS_SUPPLIERS_TABLE: Table = {
    keys: [OPTICAL_GLASS_SUPPLIER_1, OPTICAL_GLASS_SUPPLIER_2],
    fields: SUPPLIER_FIELDS,
    refName: 'OpticalGlassSupplier',
}

const EQUATORIAL_MOUNT_SUPPLIERS_TABLE: Table = {
    keys: [EQUATORIAL_MOUNT_SUPPLIER_1, EQUATORIAL_MOUNT_SUPPLIER_2],
    fields: SUPPLIER_FIELDS,
    refName: 'EquatorialMountSupplier',
}

const METAL_FITTINGS_SUPPLIERS_TABLE: Table = {
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

const PRODUCTION_LINE_LEVEL_KEYS = ['1', '2', '3'] as const

const PRODUCTION_LINE_1_LEVELS_TABLE: Table = {
    keys: PRODUCTION_LINE_LEVEL_KEYS,
    fields: PRODUCTION_LINE_LEVEL_FIELDS,
    refName: 'ProductionLine1Levels',
}

const PRODUCTION_LINE_2_LEVELS_TABLE: Table = {
    keys: PRODUCTION_LINE_LEVEL_KEYS,
    fields: PRODUCTION_LINE_LEVEL_FIELDS,
    refName: 'ProductionLine2Levels',
}

// Numeric seeds for the level ladders. Indices align with
// PRODUCTION_LINE_LEVEL_KEYS (so [0] = level 1, [2] = level 3).
// [fixedCost, maxProduction, perUnitCost, yieldAdj, upgradeCost]
//
// 最大生产数 is sized so total baseline capacity (L1 30 + L2 50 = 80)
// roughly matches one round's demand (~58 units across 3 orders).
// At baseline the player can't take every order — has to triage by
// margin and required 良品率. Upgrading both lines to L3 (60 + 90 =
// 150) removes the bottleneck and turns the game into pure margin
// play.
//
// Fixed costs tuned so a default 50/50 supplier mix is mildly
// profitable: variable cost per unit ≈ 322 (material 312 + perUnit
// 10), avg order price 407 → ~85 margin × ~30 units delivered/round
// ≈ +2550 contribution. Fixed total L1+L2 baseline: 600 + 1100 =
// 1700 → net ~+850/round. Optimisation (cheap suppliers + research)
// pushes net higher; bad choices still negative.
//
// Upgrade ROIs at the 10-round campaign cadence:
//   Line 1  L1→L2:  ~+2700 net.  ¥8000 → payback ~3 rounds.
//   Line 1  L2→L3:  ~+2700 net. ¥15000 → payback ~6 rounds (only
//                   profitable if done by ~round 4).
//   Line 2  L1→L2:  ~+6500 net. ¥12000 → payback ~2 rounds.
//   Line 2  L2→L3:  ~+8500 net. ¥25000 → payback ~3 rounds.
//
// Personalities:
//   Line 1 (精工型) smaller throughput but stronger yield bonus —
//                   pairs with budget suppliers (covers their low yield).
//   Line 2 (规模型) big throughput, weak/no yield bonus —
//                   needs premium suppliers OR aggressive precision research.
const PRODUCTION_LINE_1_LEVEL_SEEDS: ReadonlyArray<
    [number, number, number, number, number]
> = [
    [600, 30, 10, 0.02, 8000],
    [800, 45, 8, 0.05, 15000],
    [1000, 60, 6, 0.08, 0],
]

const PRODUCTION_LINE_2_LEVEL_SEEDS: ReadonlyArray<
    [number, number, number, number, number]
> = [
    [1100, 50, 8, -0.02, 12000],
    [1400, 70, 7, 0.0, 25000],
    [1700, 90, 6, 0.02, 0],
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
const PRODUCTION_LINE_TABLE: Table = {
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
            // Editable when EITHER the toggle is currently ON (so the
            // player can un-toggle to revert the in-round upgrade) OR
            // 等级 hasn't hit the cap yet. The naive `等级<cap` rule was
            // self-defeating: toggling ON at level N-1 immediately
            // bumped 等级 to N (via the upgrade bridge), which then
            // tripped the lock, leaving the player unable to un-toggle
            // a top-tier upgrade they hadn't committed yet. OR(toggle,
            // …) keeps the cell editable for the duration of an
            // in-round upgrade draft; once round-advance clears the
            // toggle, the level-cap lock kicks back in as before.
            userEditable:
                `=OR(#FIELD("${WILL_UPGRADE}"),` +
                `#FIELD("${LEVEL}")<${PRODUCTION_LINE_LEVEL_KEYS.length})`,
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

// Total cost = 固定开销 + 单位成本 × 本期产能.
// 本期产能 is now an absolute unit count (was 0..1 fraction), so the
// previous `× 最大生产数` factor is dropped — capacity already IS the
// units-produced quantity. 单位成本 lives in this same row (sibling
// field) — referenced via #FIELD so the formula picks up whichever
// templated value the engine computed for it, even across reorderings.
const TOTAL_COST_FORMULA =
    `=BLOCKREF("ProductionLine",#KEY,"${FIXED_COST}")` +
    `+#FIELD("${UNIT_COST}")` +
    `*#FIELD("${CAPACITY}")`

const PRODUCTION_LINE_CONTRIBUTION_TABLE: Table = {
    keys: [PRODUCTION_LINE_1, PRODUCTION_LINE_2],
    fields: [
        f(PRODUCTION_LINE),
        // Supplier allocations are percentages — the player splits
        // each material between its two suppliers. Convention: each
        // material's two percentages sum to 100% (see TODO above re
        // engine-enforced cross-field validation). `diyRender: true`
        // turns OFF the engine's canvas paint for these cells so the
        // host's PercentAllocatorLayer overlay owns the visual end-to-
        // end. Without it, the canvas briefly paints the bare 0..1
        // number underneath while a tx commits — visible as a flicker
        // right after clicking the +/- buttons.
        {...fPercent(OPTICAL_GLASS_SUPPLIER_1, true), diyRender: true},
        {...fPercent(OPTICAL_GLASS_SUPPLIER_2, true), diyRender: true},
        {...fPercent(EQUATORIAL_MOUNT_SUPPLIER_1, true), diyRender: true},
        {...fPercent(EQUATORIAL_MOUNT_SUPPLIER_2, true), diyRender: true},
        {...fPercent(METAL_FITTINGS_SUPPLIER_1, true), diyRender: true},
        {...fPercent(METAL_FITTINGS_SUPPLIER_2, true), diyRender: true},
        // How many units we produce this round — an integer count
        // derived as the sum of OrderConfiguration's per-line
        // allocation column. The player picks per-order allocations
        // in 销售部 and 本期产能 follows automatically; no need to
        // retype the sum into PLC.
        //
        // Cross-block ref into a block declared LATER in BLOCK_DEFS
        // works because newGame uses the two-phase bind path
        // (BindFormSchema then UpsertFieldFormulas) — by the time
        // this template is parsed, OrderConfiguration's refName +
        // field set are already registered.
        //
        // `BLOCKREFS("OrderConfiguration","*",#KEY)` — `#KEY` is
        // baked at template-materialization time to the row's key
        // literal ("一" / "二"), which matches the OrderConfiguration
        // field name for that line's per-order allocation column.
        //
        // Validation kept for visual feedback: 本期产能 ≤
        // 最大生产数. When the player over-allocates, the
        // ValidationCell warning marker fires; `advanceRound`
        // additionally hard-rejects round advance.
        {
            name: CAPACITY,
            userEditable: false,
            fieldType: 'number',
            numFmt: '0',
            valueFormula: `=SUM(BLOCKREFS("OrderConfiguration","*",#KEY))`,
            validation: `#PLACEHOLDER<=BLOCKREF("ProductionLine",#KEY,"${MAX_PRODUCTION}")`,
        },
        fFormulaPercent(EXPECTED_YIELD_RATE, EXPECTED_YIELD_FORMULA),
        fFormulaDecimal(UNIT_COST, UNIT_COST_FORMULA),
        fFormulaDecimal(TOTAL_COST, TOTAL_COST_FORMULA),
    ],
    refName: 'ProductionLineContribution',
}

const ORDER_CONTRIBUTION_TABLE: Table = {
    keys: [],
    fields: [
        f(L.fields.order),
        // Per-line delivery quantity. Validation: the column-sum
        // must stay within the matching ProductionLine row's 本期产能.
        // The validation shadow is re-evaluated after the cell value
        // commits, so BLOCKREFS already includes the new value — no
        // need to subtract/add anything. Advisory: the host renders
        // the warning marker but commits the value regardless.
        {
            name: PRODUCTION_LINE_1,
            userEditable: true,
            fieldType: 'number',
            numFmt: '0',
            validation:
                `SUM(BLOCKREFS("OrderConfiguration","*","${PRODUCTION_LINE_1}"))` +
                `<=BLOCKREF("ProductionLineContribution","${PRODUCTION_LINE_1}","${CAPACITY}")`,
        },
        {
            name: PRODUCTION_LINE_2,
            userEditable: true,
            fieldType: 'number',
            numFmt: '0',
            validation:
                `SUM(BLOCKREFS("OrderConfiguration","*","${PRODUCTION_LINE_2}"))` +
                `<=BLOCKREF("ProductionLineContribution","${PRODUCTION_LINE_2}","${CAPACITY}")`,
        },
        // 本期预计良品率 — player-editable. Validation warns when the
        // value drops below the order's required 良品率 (looked up via
        // BLOCKREF against the OrderStatus row keyed by this row's 订单
        // cell). Block-interface renders the warning marker; commit is
        // still allowed (validation is advisory).
        // 本期交付数 = 生产线一 + 生产线二. The player's raw allocation
        // — also what counts as "delivered this round" for the
        // accumulator, revenue, penalty, and remainder calcs below.
        // (Earlier revision had a yield-adjusted 实际交付数 layered
        // on top; reverted because the rounded-yield product was
        // hard to read at small numbers and the validation already
        // surfaces yield-shortfall risk well enough.)
        fFormulaDecimal(
            CURRENT_DELIVERY,
            `=#FIELD("${PRODUCTION_LINE_1}")+#FIELD("${PRODUCTION_LINE_2}")`
        ),
        // 本期预计良品率 — computed weighted average of the two
        // lines' yield rates, weighted by this row's allocation to
        // each line. Validation: must meet the order's required
        // 良品率 (advisory red marker if not). The player's lever is
        // supplier mix per line.
        //
        // IF guard avoids div-by-zero when no units are allocated.
        {
            ...fFormulaPercent(
                CURRENT_EXPECTED_YIELD_RATE,
                `=IF(#FIELD("${CURRENT_DELIVERY}")>0,` +
                    `(#FIELD("${PRODUCTION_LINE_1}")` +
                    `*BLOCKREF("ProductionLineContribution","${PRODUCTION_LINE_1}","${EXPECTED_YIELD_RATE}")` +
                    `+#FIELD("${PRODUCTION_LINE_2}")` +
                    `*BLOCKREF("ProductionLineContribution","${PRODUCTION_LINE_2}","${EXPECTED_YIELD_RATE}"))` +
                    `/#FIELD("${CURRENT_DELIVERY}")` +
                    `,0)`
            ),
            // Skip the warning while the player hasn't allocated any
            // production yet — 本期交付数=0 forces the weighted-avg
            // formula's IF guard to 0, which would otherwise fail the
            // `>=required` check on every freshly-inserted row (the
            // round-1 auto-accepted orders all start here) and light up
            // the 销售部 nav badge before the player has done anything.
            validation:
                `OR(#FIELD("${CURRENT_DELIVERY}")=0,` +
                `#PLACEHOLDER>=BLOCKREF("OrderStatus",` +
                `#FIELD("${L.fields.order}"),"${REQUIRED_YIELD_RATE}"))`,
        },
        // 剩余交付数 = 数量 − 已交付数量 − 本期交付数. Uses raw
        // allocation: deliver what you say you'll deliver.
        fFormulaDecimal(
            REMAINING_DELIVERY,
            `=BLOCKREF("OrderStatus",#FIELD("${L.fields.order}"),"${REQUIRED_AMOUNT}")` +
                `-BLOCKREF("OrderStatus",#FIELD("${L.fields.order}"),"${L.fields.deliveredAmount}")` +
                `-#FIELD("${CURRENT_DELIVERY}")`
        ),
        // 本期收入 = 本期交付数 × OrderStatus.单价. FIN_ORDER_REVENUE
        // sums this column.
        fFormulaDecimal(
            CURRENT_REVENUE,
            `=#FIELD("${CURRENT_DELIVERY}")` +
                `*BLOCKREF("OrderStatus",#FIELD("${L.fields.order}"),"${UNIT_PRICE}")`
        ),
        // 本期罚款 — non-zero ONLY on the deadline round
        // (剩余期数 == 0). 剩余交付数 may be negative if the player
        // over-delivered; IF(>0, ..., 0) clamps that. After the
        // deadline 剩余期数 returns the text '订单已完成', so the
        // outer `=0` comparison is false → 0. FIN_ORDER_PENALTY in
        // FinancialImpact sums this column.
        fFormulaDecimal(
            CURRENT_PENALTY,
            `=IF(BLOCKREF("OrderStatus",#FIELD("${L.fields.order}"),"${L.fields.remainingPeriods}")=0,` +
                `IF(#FIELD("${REMAINING_DELIVERY}")>0,` +
                `#FIELD("${REMAINING_DELIVERY}"),0)` +
                `*BLOCKREF("OrderStatus",#FIELD("${L.fields.order}"),"${UNIT_PENALTY}")` +
                `,0)`
        ),
        // 本期商誉变化:
        //   剩余交付数 ≤ 0 (fully delivered this round or earlier)
        //     → +1  reward fires the round of completion, regardless
        //     of whether it's the deadline round. The advance-time
        //     cleanup removes the order from OrderConfiguration in
        //     the same tx, so the +1 only ever fires once per order.
        //   else if 剩余期数 == 0 (deadline this round, still owe)
        //     → −本期罚款/100  reputation loss proportional to fine.
        //   else (still time to deliver, not yet done)
        //     → 0
        // FIN_GOODWILL_DELTA sums across orders.
        fFormulaDecimal(
            CURRENT_GOODWILL_CHANGE,
            `=IF(#FIELD("${REMAINING_DELIVERY}")<=0,1,` +
                `IF(BLOCKREF("OrderStatus",#FIELD("${L.fields.order}"),"${L.fields.remainingPeriods}")=0,` +
                `-#FIELD("${CURRENT_PENALTY}")/100,0))`
        ),
        // 本期品质罚款 — fires EVERY round delivery happens at a yield
        // below the order's required 良品率. Per-unit rate:
        //   (required − actual) × 10 × 单价
        // → "1% gap → 10% of 单价 per delivered unit". Multiplied by
        // 本期交付数 to get this round's total. The MAX-equivalent
        // (required > actual ? gap × … : 0) is written as nested IF
        // because the engine has no MAX function registered. Inner
        // IF gates on 本期交付数 > 0 so zero-allocation rows stay 0.
        fFormulaDecimal(
            CURRENT_QUALITY_PENALTY,
            `=IF(#FIELD("${CURRENT_DELIVERY}")>0,` +
                `IF(BLOCKREF("OrderStatus",#FIELD("${L.fields.order}"),"${REQUIRED_YIELD_RATE}")` +
                `>#FIELD("${CURRENT_EXPECTED_YIELD_RATE}"),` +
                `(BLOCKREF("OrderStatus",#FIELD("${L.fields.order}"),"${REQUIRED_YIELD_RATE}")` +
                `-#FIELD("${CURRENT_EXPECTED_YIELD_RATE}"))` +
                `*BLOCKREF("OrderStatus",#FIELD("${L.fields.order}"),"${UNIT_PRICE}")` +
                `*#FIELD("${CURRENT_DELIVERY}")` +
                `*10` +
                `,0)` +
                `,0)`
        ),
    ],
    refName: 'OrderConfiguration',
}

const NEW_ORDER_STATUS_TABLE: Table = {
    keys: [],
    fields: [
        f(ORDER_ID),
        f(REQUIRED_AMOUNT),
        f(L.fields.periods),
        fPercent(REQUIRED_YIELD_RATE),
        fDecimal(UNIT_PRICE),
        // Per-unit penalty — stored, not formula-derived. Rolled at
        // order generation as UNIT_PRICE × random int in [1,3]. The
        // total penalty an order incurs is computed downstream as
        // 单位违约金 × 未交付数量 (only on the deadline round); see
        // CURRENT_PENALTY in ORDER_CONTRIBUTION_TABLE.
        fDecimal(UNIT_PENALTY),
        // Editable only when the row actually carries an order — sentinel
        // / empty trailing rows should not present a clickable checkbox.
        // `=#FIELD("订单编号")<>""` evaluates per-row at render time and
        // is gated by the host's useEditable hook via the UserEditable
        // shadow (pre-installed in newGame phase 3).
        fBool(L.fields.isAccepted, `=#FIELD("${ORDER_ID}")<>""`),
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
const ACCEPTED_ORDER_STATUS_TABLE: Table = {
    keys: [],
    fields: [
        f(ORDER_ID),
        f(REQUIRED_AMOUNT),
        f(L.fields.periods),
        fPercent(REQUIRED_YIELD_RATE),
        fDecimal(UNIT_PRICE),
        // Per-unit penalty, copied verbatim from NEW_ORDER_STATUS_TABLE
        // by insertAcceptedOrder so a rolled-once-on-generation penalty
        // multiplier sticks for the lifetime of the order.
        fDecimal(UNIT_PENALTY),
        f(L.fields.acceptedRound),
        // 已交付数量 — accumulator. advanceRound adds this row's
        // OrderConfiguration.本期交付数 to this cell at the end of each
        // round. Stored number (not a formula): persisting it lets us
        // recover lifetime delivery total without re-summing history.
        // Number-typed so OrderConfiguration's 剩余交付数 formula
        // (which subtracts via BLOCKREF) gets clean numeric arithmetic.
        {
            name: L.fields.deliveredAmount,
            userEditable: false,
            fieldType: 'number',
            numFmt: '0',
        },
        {
            name: L.fields.remainingPeriods,
            userEditable: false,
            fieldType: 'number',
            numFmt: '0',
            valueFormula:
                `=IF(#FIELD("${L.fields.periods}")+#FIELD("${L.fields.acceptedRound}")` +
                `-BLOCKREF("Constants","round","value")<0,` +
                `"${L.status.orderComplete}",` +
                `#FIELD("${L.fields.periods}")+#FIELD("${L.fields.acceptedRound}")` +
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
    line: string,
    levelsRef: string
): string =>
    `=IF(BLOCKREF("ProductionLine","${line}","${WILL_UPGRADE}"),` +
    `-BLOCKREF("${levelsRef}",BLOCKREF("ProductionLine","${line}","${LEVEL}")-1,"${UPGRADE_COST}"),` +
    `0)`

// 生产线一/二支出 — running this round's production for that line costs:
//   固定开销  + 本期产能 × 每件产品开销
// 本期产能 is now an absolute unit count (was 0..1 fraction), so it
// already represents "units produced this round" and the previous
// 最大生产数 multiplier is gone. Result is negated because FinancialImpact
// uses signed convention (costs negative, revenue positive) so the
// row-sum can be applied straight to 资金 in advanceRound.
const finImpactProductionLineCostFormula = (line: string): string =>
    `=-(BLOCKREF("ProductionLine","${line}","${FIXED_COST}")` +
    `+BLOCKREF("ProductionLineContribution","${line}","${CAPACITY}")` +
    `*BLOCKREF("ProductionLine","${line}","${PER_UNIT_COST}"))`

// Per (line, supplier) contribution to material cost:
//   本期产能 × 该供应商占比 × 该供应商单价
// where 本期产能 IS units produced this round (post integer-cap
// switch). The supplier % lives in ProductionLineContribution under a
// field named after the supplier; the unit price lives in the
// material's supplier table under that supplier's key row.
const finImpactSupplierPiece = (
    line: string,
    supplier: string,
    supplierRefName: string
): string =>
    `BLOCKREF("ProductionLineContribution","${line}","${CAPACITY}")` +
    `*BLOCKREF("ProductionLineContribution","${line}","${supplier}")` +
    `*BLOCKREF("${supplierRefName}","${supplier}","${UNIT_PRICE}")`

// 光学玻璃支出 / 赤道仪支出 / 金属配件支出 — sum over 2 lines × 2
// suppliers of this material. Negated for signed-convention.
const finImpactMaterialCostFormula = (
    supplierRefName: string,
    s1: string,
    s2: string
): string =>
    `=-(` +
    finImpactSupplierPiece(PRODUCTION_LINE_1, s1, supplierRefName) +
    `+` +
    finImpactSupplierPiece(PRODUCTION_LINE_1, s2, supplierRefName) +
    `+` +
    finImpactSupplierPiece(PRODUCTION_LINE_2, s1, supplierRefName) +
    `+` +
    finImpactSupplierPiece(PRODUCTION_LINE_2, s2, supplierRefName) +
    `)`

const FIN_IMPACT_PER_ROW_FORMULA: Record<string, string> = {
    [FIN_PRODUCTION_LINE_1_COST]: finImpactProductionLineCostFormula(PRODUCTION_LINE_1),
    [FIN_PRODUCTION_LINE_2_COST]: finImpactProductionLineCostFormula(PRODUCTION_LINE_2),
    [FIN_OPTICAL_GLASS_COST]: finImpactMaterialCostFormula(
        'OpticalGlassSupplier',
        OPTICAL_GLASS_SUPPLIER_1,
        OPTICAL_GLASS_SUPPLIER_2
    ),
    [FIN_EQUATORIAL_MOUNT_COST]: finImpactMaterialCostFormula(
        'EquatorialMountSupplier',
        EQUATORIAL_MOUNT_SUPPLIER_1,
        EQUATORIAL_MOUNT_SUPPLIER_2
    ),
    [FIN_METAL_FITTINGS_COST]: finImpactMaterialCostFormula(
        'MetalFittingsSupplier',
        METAL_FITTINGS_SUPPLIER_1,
        METAL_FITTINGS_SUPPLIER_2
    ),
    // 订单收入 — sum of every OrderConfiguration row's 本期收入
    // (= 实际交付数 × OrderStatus.单价, computed per-row inside the
    // OrderContribution block so this can stay a single SUM).
    [FIN_ORDER_REVENUE]: `=SUM(BLOCKREFS("OrderConfiguration","*","${CURRENT_REVENUE}"))`,
    // 订单罚款 — negated sum of per-row 本期罚款. The deadline gate
    // lives in the per-row formula, so off-deadline rounds naturally
    // sum to 0 and on-deadline rounds expose the real exposure for
    // the preview. AdvanceRound just reads this cell to apply to 资金
    // — no JS-side settlement loop anymore.
    [FIN_ORDER_PENALTY]: `=-SUM(BLOCKREFS("OrderConfiguration","*","${CURRENT_PENALTY}"))`,
    // 品质罚款 — continuous yield-gap fine, separate from the
    // discrete deadline-failure penalty above. Negated for the
    // signed-cost convention.
    [FIN_QUALITY_PENALTY]: `=-SUM(BLOCKREFS("OrderConfiguration","*","${CURRENT_QUALITY_PENALTY}"))`,
    // 商誉变化 — sum of per-row 本期商誉变化. Same deadline gate at
    // the per-row level. AdvanceRound reads this cell to apply the
    // delta to 商誉 (clamped to [0,150]).
    [FIN_GOODWILL_DELTA]: `=SUM(BLOCKREFS("OrderConfiguration","*","${CURRENT_GOODWILL_CHANGE}"))`,
    [FIN_PRODUCTION_LINE_1_UPGRADE]: finImpactUpgradeFormula(
        PRODUCTION_LINE_1,
        'ProductionLine1Levels'
    ),
    [FIN_PRODUCTION_LINE_2_UPGRADE]: finImpactUpgradeFormula(
        PRODUCTION_LINE_2,
        'ProductionLine2Levels'
    ),
}

// 下期财政影响 — per-bucket preview of next round's cash / goodwill
// movement. Two-column name/value shape mirrors CONSTRAINTS.
const FINANCIAL_IMPACT_TABLE: Table = {
    keys: [
        FIN_PRODUCTION_LINE_1_COST,
        FIN_PRODUCTION_LINE_2_COST,
        FIN_OPTICAL_GLASS_COST,
        FIN_EQUATORIAL_MOUNT_COST,
        FIN_METAL_FITTINGS_COST,
        FIN_GOODWILL_DELTA,
        FIN_ORDER_REVENUE,
        FIN_ORDER_PENALTY,
        FIN_QUALITY_PENALTY,
        FIN_PRODUCTION_LINE_1_UPGRADE,
        FIN_PRODUCTION_LINE_2_UPGRADE,
    ],
    fields: [f(L.fields.item), fDecimal(L.fields.value)],
    refName: 'FinancialImpact',
}

// 财务状况 — top-line cash + goodwill snapshot.
const FINANCIAL_STATUS_TABLE: Table = {
    keys: [FUND, GOODWILL],
    fields: [f(L.fields.item), fDecimal(L.fields.value)],
    refName: 'FinancialStatus',
}

const CONSTRAINTS: Table = {
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
const ALL_SUPPLIER_NAMES: readonly string[] = [
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
const SUPPLIER_ACCUMULATOR_TABLE: Table = {
    keys: ALL_SUPPLIER_NAMES,
    fields: [
        f(L.fields.supplier),
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
const RESEARCH_TIERS_TABLE: Table = {
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

function createSheet(name: string, idx: number): EditPayload {
    const p = new CreateSheetBuilder().idx(idx).newName(name).build()
    return {
        type: 'createSheet',
        value: p,
    }
}

// Sheets created in this order → indices 0..1
const SHEET_ORDER = [ENGINE_SHEET, MAIN_SHEET] as const

const SHEET_IDX: Record<string, number> = Object.fromEntries(
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

// Balance pass: pull the premium/budget gap WAY apart so 50/50 split
// isn't free anymore. After the yield-affects-delivery change, each
// material's mix is a real trade-off:
//   premium = ~25% pricier, ships 25–30 percentage points more yield
//   budget  = cheap upfront, eats penalty risk + needs joint research
// Player learns: research cheap suppliers (lots of yield headroom),
// or commit to premium and earn through on-time bonuses.
const SUPPLIER_BASE_STATS: Record<string, [SupplierStat, SupplierStat]> = {
    // refName → [premium, budget]
    OpticalGlassSupplier: [
        {yieldRate: 0.95, unitPrice: 140},
        {yieldRate: 0.65, unitPrice: 75},
    ],
    EquatorialMountSupplier: [
        {yieldRate: 0.92, unitPrice: 200},
        {yieldRate: 0.68, unitPrice: 110},
    ],
    MetalFittingsSupplier: [
        {yieldRate: 0.96, unitPrice: 70},
        {yieldRate: 0.75, unitPrice: 30},
    ],
}

// How much each per-game tilt can swing the base values. Independent
// multiplier per attribute, applied uniformly to BOTH suppliers in a
// category so the premium/budget trade-off ratio is preserved.
//   ±5% for yield (kept tight so 良品率 stays believable)
//   ±15% for price (more variance to make games feel different)
const YIELD_SPREAD = 0.1
const PRICE_SPREAD = 0.3

// ============================================================================
// Seeded RNG
// ----------------------------------------------------------------------------
// Deterministic replays require every per-round roll to derive from
// the game's root seed (written to Constants.seed at newGame). We use
// mulberry32 — small, fast, good enough for game-balance jitter — and
// an FNV-1a-ish multipart hash to derive per-(round, index) sub-seeds
// without threading mutable RNG state through call chains. Same
// (rootSeed, round, indexInRound) → same numbers, always.
//
// Pure: no Math.random fallback anywhere in these primitives. Callers
// that genuinely want non-deterministic randomness should pass
// `Math.random` as the rng parameter explicitly.
// ============================================================================

function mulberry32(seed: number): () => number {
    let s = seed >>> 0
    return () => {
        s = (s + 0x6d2b79f5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/**
 * Combine arbitrary parts into a deterministic 32-bit hash. Each part
 * stringifies; we run an FNV-1a-ish mix per-character with a separator
 * mix between parts so `hashSeed(12, 3)` ≠ `hashSeed(1, 23)`. Output
 * is suitable as a mulberry32 seed.
 */
function hashSeed(...parts: Array<number | string>): number {
    let h = 0x811c9dc5
    for (const p of parts) {
        const s = String(p)
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i)
            h = Math.imul(h, 0x01000193) >>> 0
        }
        // Distinct mix between parts.
        h ^= 0x9e3779b1
        h = Math.imul(h, 0x01000193) >>> 0
    }
    return h >>> 0
}

/**
 * Convert the float seed we store in Constants.seed (0..1 from
 * Math.random at newGame) into the u32 mulberry32 wants. `|0` would
 * truncate to 0 for sub-1 floats; multiply through 2^32 first.
 */
function rootSeedToU32(seed: number): number {
    if (!Number.isFinite(seed) || seed === 0) return 1
    return Math.floor(seed * 0xffffffff) >>> 0 || 1
}

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
type BlockKey =
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

type BlockIds = Record<BlockKey, number>

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
    // 采购 — supplier tables. Must bind before any block whose
    // formulas do BLOCKREF("OpticalGlassSupplier", …) etc.
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
    // contribution / control panel that references both suppliers
    // and the parameter table.
    {key: 'productionLine', table: PRODUCTION_LINE_TABLE, sheet: PLANT},
    {
        key: 'productionLineContribution',
        table: PRODUCTION_LINE_CONTRIBUTION_TABLE,
        sheet: PLANT,
    },
    // 销售部 — order tables. Binding order matters here: BindFormSchema's
    // parse-time pass resolves `BLOCKREF("OrderStatus", …)` /
    // `BLOCKREF("ProductionLineContribution", …)` strings into stable
    // (sheet_id, block_id, field_id) ids; if the target block isn't
    // bound yet, the parser silently falls back to treating BLOCKREF
    // as a generic function (→ permanent #NAME? at eval time on the
    // sentinel row 0, which then sticks around when insertOrderConfig
    // reuses that row for the first accepted order).
    //
    // OrderConfiguration references both `OrderStatus`
    // (acceptedOrderStatus) AND `ProductionLineContribution`. We've
    // already bound suppliers + production-line above, so the SALES
    // section as a whole now lands last among the dependency-chain.
    // NEW_ORDER_STATUS_TABLE has no inbound BLOCKREFs; placement
    // among the SALES siblings is layout-only.
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
    let asciiCount = 0
    let cjkCount = 0
    for (const ch of name) {
        if (CJK.test(ch)) cjkCount++
        else asciiCount++
    }
    // Excel column-width unit ≈ width of the "0" glyph. ASCII glyphs
    // average ~0.75 of that; CJK glyphs ~2x. Counting them separately
    // keeps English headers from getting the slack a uniform 1.2x
    // multiplier gave them.
    const width = asciiCount * 0.9 + cjkCount * 2
    if (width <= 7) return null // fits within the ~8.43 default width
    return width + 1 // small padding for breathing room
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
        if (!sid || isErrorMessage(sid)) continue
        if (!sid.cellId || sid.cellId.type !== 'ephemeralCell') continue
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
async function installUserEditableShadowsForRows(
    client: Client,
    sheetIdx: number,
    fields: readonly Field[],
    absoluteRows: readonly number[],
    /** See {@link installValidationShadowsForRows}'s `temp` arg. */
    temp: boolean = false
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
        transaction: {payloads, undoable: false, temp},
    })
    if (isErrorMessage(tx))
        throw new Error(
            `userEditable shadow install failed: ${JSON.stringify(tx)}`
        )
}

/**
 * Install Validation shadows for the specified rows. Mirrors
 * `installUserEditableShadowsForRows` but for `field.validation`
 * formulas.
 *
 * Why this exists when `ValidationCell` already installs lazily:
 * the lazy install fires a `temp:false` tx the first time the widget
 * sees `shadowValue === undefined`. In temp-mode games (this craft
 * runs in global temp mode), that non-temp tx clobbers any in-flight
 * temp branch — same shape as the old useEditable bug. Pre-installing
 * here means the widget always sees a populated shadow and never
 * fires its non-temp install path. Also fixes row 0 specifically:
 * `insertOrderConfig` reuses the sentinel row 0 if it's empty, so the
 * "fresh row" hook never fires and the lazy ValidationCell install
 * was the only path — but with subtle race conditions.
 */
async function installValidationShadowsForRows(
    client: Client,
    sheetIdx: number,
    fields: readonly Field[],
    absoluteRows: readonly number[],
    /**
     * Commit the install on the temp branch instead of canonical
     * state. REQUIRED when the caller itself is running on a temp
     * branch (e.g. insertOrderConfig fired from a 是否接受 toggle):
     * a temp:false install inside a temp:true caller wipes the
     * active temp branch via the engine's "non-temp tx clears any
     * active temp branch" rule, taking the accept-toggle's effects
     * with it. For pure-canonical callers (newGame phase 3), the
     * default `false` is correct.
     */
    temp: boolean = false
): Promise<void> {
    const sites: Array<{
        sheetIdx: number
        row: number
        col: number
        formula: string
    }> = []
    fields.forEach((field, fieldIdx) => {
        const v = field.validation
        if (typeof v !== 'string' || !v.trim()) return
        const normalized = v.startsWith('=') ? v : `=${v}`
        for (const row of absoluteRows) {
            sites.push({sheetIdx, row, col: fieldIdx, formula: normalized})
        }
    })
    if (sites.length === 0) return
    // Build ephemeral install payloads — same shape as the
    // userEditable path but allocating shadows with `kind: 'validation'`.
    const payloads: EditPayload[] = []
    for (const site of sites) {
        const sid = await client.getShadowCellId({
            sheetIdx: site.sheetIdx,
            rowIdx: site.row,
            colIdx: site.col,
            kind: 'validation',
        })
        // `isErrorMessage(undefined)` is false (only matches {msg,
        // ty}), so also guard against the RPC returning undefined /
        // null. Same for `cellId` nested inside — cheaper to skip
        // one stale shadow install than crash the whole pass.
        if (!sid || isErrorMessage(sid)) continue
        if (!sid.cellId || sid.cellId.type !== 'ephemeralCell') continue
        const eid = sid.cellId.value as number
        payloads.push({
            type: 'ephemeralCellInput',
            value: new EphemeralCellInputBuilder()
                .id(eid)
                .sheetIdx(site.sheetIdx)
                .content(site.formula)
                .build(),
        })
    }
    if (payloads.length === 0) return
    const tx = await client.handleTransaction({
        transaction: {payloads, undoable: false, temp},
    })
    if (isErrorMessage(tx))
        throw new Error(
            `validation shadow install failed: ${JSON.stringify(tx)}`
        )
}

// ============================================================================
// Lightweight game-status read
// ----------------------------------------------------------------------------
// Snapshot of the headline numbers the status bar shows: current round
// + 资金 + 商誉. One getBlockInfo per source block (constants + financial-
// status). Safe to call repeatedly; doesn't mutate state.
// ============================================================================

interface GameStatus {
    round: number
    maxRounds: number
    fund: number
    goodwill: number
    /** Endgame state. `'playing'` when the campaign is in progress. */
    gameState: GameState
}

async function getGameStatus(
    client: Client,
    blockIds: BlockIds
): Promise<GameStatus | null> {
    const mainSheetIdx = SHEET_IDX[MAIN_SHEET]
    const engineSheetIdx = SHEET_IDX[ENGINE_SHEET]
    const mainSheetId = await client.getSheetId({sheetIdx: mainSheetIdx})
    if (isErrorMessage(mainSheetId)) return null
    const engineSheetId = await client.getSheetId({sheetIdx: engineSheetIdx})
    if (isErrorMessage(engineSheetId)) return null
    const [constantsInfo, financialStatusInfo] = await Promise.all([
        client.getBlockInfo({
            sheetId: engineSheetId,
            blockId: blockIds.constants,
        }),
        client.getBlockInfo({
            sheetId: mainSheetId,
            blockId: blockIds.financialStatus,
        }),
    ])
    if (isErrorMessage(constantsInfo) || isErrorMessage(financialStatusInfo))
        return null
    const roundRowIdx = CONSTANTS_TABLE.keys.indexOf('round')
    const roundValueColIdx = CONSTANTS_TABLE.fields.findIndex(
        (fi) => fi.name === 'value'
    )
    const round = numericCellValue(
        constantsInfo.cells[
            roundRowIdx * constantsInfo.colCnt + roundValueColIdx
        ]?.value
    )
    const gameStateRowIdx = CONSTANTS_TABLE.keys.indexOf(CONST_KEY_GAME_STATE)
    const rawGameState = cellValueAsString(
        constantsInfo.cells[
            gameStateRowIdx * constantsInfo.colCnt + roundValueColIdx
        ]?.value
    )
    const gameState: GameState =
        (rawGameState as GameState) || 'playing'
    const fundValueCol = FINANCIAL_STATUS_TABLE.fields.findIndex(
        (fi) => fi.name === L.fields.value
    )
    const fundRowIdx = FINANCIAL_STATUS_TABLE.keys.indexOf(FUND)
    const goodwillRowIdx = FINANCIAL_STATUS_TABLE.keys.indexOf(GOODWILL)
    const fund = numericCellValue(
        financialStatusInfo.cells[
            fundRowIdx * financialStatusInfo.colCnt + fundValueCol
        ]?.value
    )
    const goodwill = numericCellValue(
        financialStatusInfo.cells[
            goodwillRowIdx * financialStatusInfo.colCnt + fundValueCol
        ]?.value
    )
    return {
        round: Number.isFinite(round) ? round : 0,
        maxRounds: MAX_ROUNDS,
        fund: Number.isFinite(fund) ? fund : 0,
        goodwill: Number.isFinite(goodwill) ? goodwill : GOODWILL_BASELINE,
        gameState,
    }
}

// ============================================================================
// Validation monitor
// ----------------------------------------------------------------------------
// Many fields carry `validation` formulas (e.g. OrderConfiguration's
// 生产线一/生产线二 column-sum ≤ 本期产能, ProductionLineContribution's
// 本期产能 ≤ 最大生产数). The engine auto-installs a per-cell Validation
// shadow ephemeral for each. The shadow evaluates to TRUE when the rule
// holds and FALSE when it doesn't — that's the "advisory warning"
// signal the block-interface widgets render today as a yellow corner.
//
// This monitor pulls those signals up to the navigation surface. We
// enumerate every (cell, validation-formula) pair on each subscribe
// pass, resolve its shadow id, read the value, and subscribe via
// `registerCellValueChangedByCellId`. A module-level
// (sheetIdx:row:col) → bool map holds the latest failing state; the
// caller's `onChange` fires whenever the rolled-up per-nav-group
// counts change.
//
// New rows from `insertOrder` / `insertAcceptedOrder` aren't picked
// up automatically — call `refreshValidationSubscriptions` again
// after those tx commit and the helper will subscribe the freshly-
// grown rows (already-subscribed cells are skipped idempotently).
// ============================================================================

interface ValidationFailingCell {
    /** Nav-button identity this cell rolls up into (e.g. '销售部'). */
    navKey: string
    sheetIdx: number
    /** Sheet-absolute row index. */
    row: number
    /** Sheet-absolute col index. */
    col: number
    /** refName of the block this cell lives in. */
    refName: string
    /** Field name within the block (e.g. '生产线一'). */
    fieldName: string
    /** Row position within the block (0-indexed). */
    rowInBlock: number
}

/** navKey → { failing count, list of failing cells, available hints }. */
type ValidationState = Record<
    string,
    {
        failingCount: number
        cells: ValidationFailingCell[]
        /**
         * Count of opportunities the player MIGHT want to act on but
         * haven't (e.g. 联合研发 unlocked but not yet picked). Rendered
         * as a green hint badge — informational, never blocking. Absent
         * (undefined) means the nav has no hint surface; 0 means it has
         * one but nothing is currently available.
         */
        availableCount?: number
        availableCells?: ValidationFailingCell[]
    }
>

interface ValidationCellRef {
    navKey: string
    refName: string
    fieldName: string
    sheetIdx: number
    row: number
    col: number
    rowInBlock: number
}

/**
 * navKey → (refName, blockKey) it monitors. Order in the array
 * matters only for stability of the resulting iteration; the rollup
 * is per-navKey regardless.
 */
const VALIDATION_NAV_MAP: ReadonlyArray<{
    navKey: string
    refName: string
    blockKey: BlockKey
}> = [
    {
        navKey: L.nav.sales,
        refName: 'OrderConfiguration',
        blockKey: 'orderContribution',
    },
    {
        navKey: L.nav.plant,
        refName: 'ProductionLineContribution',
        blockKey: 'productionLineContribution',
    },
]

// Module-level monitor state — persists across `refreshValidation-
// Subscriptions` calls so we don't double-subscribe after a row
// insert. Cleared on game tear-down (newGame's first call clears
// implicitly by resetting blockIds, but consumers can call
// `clearValidationMonitorState` for an explicit reset).
const _validationFailingByCell = new Map<string, boolean>()
const _validationCellByKey = new Map<string, ValidationCellRef>()
const _validationSubscribedKeys = new Set<string>()

// Parallel maps for "hint" cells (green badges). Tracks userEditable
// shadows that flipped TRUE — currently used by the supplier 联合研发
// availability hint on 采购部. Same key shape as the failing-cell maps.
const _hintAvailableByCell = new Map<string, boolean>()
const _hintCellByKey = new Map<string, ValidationCellRef>()
const _hintSubscribedKeys = new Set<string>()

const _validationCellKey = (sheetIdx: number, row: number, col: number) =>
    `${sheetIdx}:${row}:${col}`

function clearValidationMonitorState(): void {
    _validationFailingByCell.clear()
    _validationCellByKey.clear()
    _validationSubscribedKeys.clear()
    _hintAvailableByCell.clear()
    _hintCellByKey.clear()
    _hintSubscribedKeys.clear()
}

function _computeValidationState(): ValidationState {
    const out: ValidationState = {}
    const ensure = (navKey: string) => {
        if (!out[navKey]) out[navKey] = {failingCount: 0, cells: []}
        return out[navKey]
    }
    for (const cell of _validationCellByKey.values()) {
        const bucket = ensure(cell.navKey)
        const k = _validationCellKey(cell.sheetIdx, cell.row, cell.col)
        if (_validationFailingByCell.get(k)) {
            bucket.failingCount += 1
            bucket.cells.push({
                navKey: cell.navKey,
                refName: cell.refName,
                fieldName: cell.fieldName,
                sheetIdx: cell.sheetIdx,
                row: cell.row,
                col: cell.col,
                rowInBlock: cell.rowInBlock,
            })
        }
    }
    // Hints: same shape, separate map. Initialise the nav's hint
    // surface to (0, []) the first time we see any tracked hint cell
    // for it so the host can tell "hint surface exists, currently
    // empty" apart from "no hint surface here at all" (undefined).
    for (const cell of _hintCellByKey.values()) {
        const bucket = ensure(cell.navKey)
        if (bucket.availableCount === undefined) {
            bucket.availableCount = 0
            bucket.availableCells = []
        }
        const k = _validationCellKey(cell.sheetIdx, cell.row, cell.col)
        if (_hintAvailableByCell.get(k)) {
            bucket.availableCount += 1
            bucket.availableCells!.push({
                navKey: cell.navKey,
                refName: cell.refName,
                fieldName: cell.fieldName,
                sheetIdx: cell.sheetIdx,
                row: cell.row,
                col: cell.col,
                rowInBlock: cell.rowInBlock,
            })
        }
    }
    return out
}

function _shadowIndicatesFailure(
    v: Value | 'empty' | undefined
): boolean {
    if (v === undefined || v === 'empty') return false
    if (v.type === 'bool') return v.value === false
    if (v.type === 'number') return v.value === 0
    if (v.type === 'error') return true // fail-closed on errored formulas
    return false
}

/**
 * Idempotent subscribe pass. Enumerates every validation-bearing cell
 * across the nav-monitored blocks, resolves its validation shadow id,
 * reads the current value, and subscribes for future updates. Cells
 * already subscribed by a previous call are skipped. Calls `onChange`
 * once at the end of the pass with the current rolled-up state, and
 * again whenever any cell's failing state flips.
 */
async function refreshValidationSubscriptions(
    client: Client,
    blockIds: BlockIds,
    onChange: (state: ValidationState) => void
): Promise<void> {
    const sheetIdx = SHEET_IDX[MAIN_SHEET]
    const sheetIdResp = await client.getSheetId({sheetIdx})
    if (isErrorMessage(sheetIdResp)) return

    const tableByBlockKey: Record<string, Table | undefined> = {
        orderContribution: ORDER_CONTRIBUTION_TABLE,
        productionLineContribution: PRODUCTION_LINE_CONTRIBUTION_TABLE,
    }

    const fireUpdate = () => {
        try {
            onChange(_computeValidationState())
        } catch {
            // Consumer threw — don't let it kill the subscription loop.
        }
    }

    for (const nav of VALIDATION_NAV_MAP) {
        const table = tableByBlockKey[nav.blockKey]
        if (!table) continue
        const blockId = blockIds[nav.blockKey]
        const info = await client.getBlockInfo({
            sheetId: sheetIdResp,
            blockId,
        })
        if (isErrorMessage(info)) continue
        const validatedFields = table.fields
            .map((field, colIdx) => ({field, colIdx}))
            .filter(
                (f) =>
                    typeof f.field.validation === 'string' &&
                    f.field.validation.trim().length > 0
            )
        for (let r = 0; r < info.rowCnt; r++) {
            for (const {field, colIdx} of validatedFields) {
                const absRow = info.rowStart + r
                const absCol = info.colStart + colIdx
                const key = _validationCellKey(sheetIdx, absRow, absCol)
                if (_validationSubscribedKeys.has(key)) continue
                // Record meta even before shadow lookup so state
                // rollup knows about the cell.
                _validationCellByKey.set(key, {
                    navKey: nav.navKey,
                    refName: nav.refName,
                    fieldName: field.name,
                    sheetIdx,
                    row: absRow,
                    col: absCol,
                    rowInBlock: r,
                })
                const sid = await client.getShadowCellId({
                    sheetIdx,
                    rowIdx: absRow,
                    colIdx: absCol,
                    kind: 'validation',
                })
                // `isErrorMessage(undefined)` is false (only matches
                // {msg, ty}), so we also have to guard against the
                // RPC returning undefined / null directly — which
                // happens for schema/cell combinations the controller
                // can't resolve at this point. Same for the
                // `cellId` field nested inside.
                if (!sid || isErrorMessage(sid)) continue
                if (!sid.cellId || sid.cellId.type !== 'ephemeralCell')
                    continue
                const eid = sid.cellId.value as number
                const initialInfo = await client.getShadowInfoById({
                    shadowId: eid,
                })
                if (initialInfo && !isErrorMessage(initialInfo)) {
                    _validationFailingByCell.set(
                        key,
                        _shadowIndicatesFailure(initialInfo.value)
                    )
                }
                _validationSubscribedKeys.add(key)
                client.registerCellValueChangedByCellId(sid, async () => {
                    const next = await client.getShadowInfoById({
                        shadowId: eid,
                    })
                    if (!next || isErrorMessage(next)) return
                    const prev = _validationFailingByCell.get(key) ?? false
                    const cur = _shadowIndicatesFailure(next.value)
                    if (prev === cur) return
                    _validationFailingByCell.set(key, cur)
                    fireUpdate()
                })
            }
        }
    }

    // Hint pass: subscribe to the userEditable shadow on each supplier
    // row's 联合研发 cell. When the shadow flips TRUE, that supplier
    // has a fresh joint-research opportunity unlocked and should
    // surface a green badge on 采购部.
    const SUPPLIER_HINT_BLOCKS: ReadonlyArray<{
        navKey: string
        refName: string
        blockKey: BlockKey
    }> = [
        {
            navKey: L.nav.procurement,
            refName: 'OpticalGlassSupplier',
            blockKey: 'opticalGlassSuppliers',
        },
        {
            navKey: L.nav.procurement,
            refName: 'EquatorialMountSupplier',
            blockKey: 'equatorialMountSuppliers',
        },
        {
            navKey: L.nav.procurement,
            refName: 'MetalFittingsSupplier',
            blockKey: 'metalFittingsSuppliers',
        },
    ]
    const jointResearchCol = SUPPLIER_FIELDS.findIndex(
        (f) => f.name === JOINT_RESEARCH
    )
    if (jointResearchCol >= 0) {
        for (const hint of SUPPLIER_HINT_BLOCKS) {
            const blockId = blockIds[hint.blockKey]
            if (blockId === undefined) continue
            const info = await client.getBlockInfo({
                sheetId: sheetIdResp,
                blockId,
            })
            if (isErrorMessage(info)) continue
            for (let r = 0; r < info.rowCnt; r++) {
                const absRow = info.rowStart + r
                const absCol = info.colStart + jointResearchCol
                const key = _validationCellKey(sheetIdx, absRow, absCol)
                if (_hintSubscribedKeys.has(key)) continue
                _hintCellByKey.set(key, {
                    navKey: hint.navKey,
                    refName: hint.refName,
                    fieldName: JOINT_RESEARCH,
                    sheetIdx,
                    row: absRow,
                    col: absCol,
                    rowInBlock: r,
                })
                const sid = await client.getShadowCellId({
                    sheetIdx,
                    rowIdx: absRow,
                    colIdx: absCol,
                    kind: 'userEditable',
                })
                if (!sid || isErrorMessage(sid)) continue
                if (!sid.cellId || sid.cellId.type !== 'ephemeralCell')
                    continue
                const eid = sid.cellId.value as number
                const initialInfo = await client.getShadowInfoById({
                    shadowId: eid,
                })
                if (initialInfo && !isErrorMessage(initialInfo)) {
                    _hintAvailableByCell.set(
                        key,
                        _shadowIndicatesAvailable(initialInfo.value)
                    )
                }
                _hintSubscribedKeys.add(key)
                client.registerCellValueChangedByCellId(sid, async () => {
                    const next = await client.getShadowInfoById({
                        shadowId: eid,
                    })
                    if (!next || isErrorMessage(next)) return
                    const prev = _hintAvailableByCell.get(key) ?? false
                    const cur = _shadowIndicatesAvailable(next.value)
                    if (prev === cur) return
                    _hintAvailableByCell.set(key, cur)
                    fireUpdate()
                })
            }
        }
    }

    fireUpdate()
}

function _shadowIndicatesAvailable(
    v: Value | 'empty' | undefined
): boolean {
    if (v === undefined || v === 'empty') return false
    if (v.type === 'bool') return v.value === true
    if (v.type === 'number') return v.value !== 0
    return false // errors / strings: treat as "not available"
}

/**
 * Craft → host notification channel. The host installs
 * `window.notifyCraft(level, message)` on the iframe's contentWindow
 * (see craft-panel/index.tsx). Crafts call it through this wrapper so
 * we don't crash when the host build predates the channel and so the
 * call site reads as a normal function.
 */
type NotifyLevel = 'error' | 'warn' | 'info' | 'success'
function notifyHost(level: NotifyLevel, message: string): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fn = (window as any).notifyCraft as
            | ((l: NotifyLevel, m: string) => void)
            | undefined
        fn?.(level, message)
    } catch {
        // host channel missing or threw — swallow so the craft keeps
        // running.
    }
}

/**
 * Thrown by `newGame` when one of the sheet names the craft wants to
 * create is already taken by another sheet in the workbook. The
 * notification has already been surfaced via `notifyHost`; callers
 * should treat the throw as "abort, the user has been told why".
 */
class SheetNameCollisionError extends Error {
    constructor(public readonly conflicts: readonly string[]) {
        super(
            `factory-simulator: sheet name(s) already taken: ${conflicts.join(
                ', '
            )}`
        )
        this.name = 'SheetNameCollisionError'
    }
}

async function newGame(
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
        L.research.menuLabel,
        [
            {
                id: RESEARCH_PRECISION_ID,
                value: L.research.precision,
                color: '#22c55e',
            },
            {
                id: RESEARCH_COST_ID,
                value: L.research.cost,
                color: '#f59e0b',
            },
            {
                id: RESEARCH_BALANCED_ID,
                value: L.research.balanced,
                color: '#3b82f6',
            },
        ],
        L.research.menuHint
    )

    // Reset the validation monitor's module state — a new game means
    // the prior game's shadow ids are stale and shouldn't roll up
    // anymore. Subscriptions themselves leak (no unregister API) but
    // their callbacks become no-ops since their cellKeys will never
    // re-appear in the new game's freshly-enumerated set.
    clearValidationMonitorState()

    // Phase 1 — create sheets.
    // Probe current sheet count, then append our sheets in order.
    const result = await client.getAllSheetInfo()
    if (isErrorMessage(result)) throw Error('')

    // Refuse to overwrite existing sheets with the same name. The
    // workbook indexes sheets by name internally for some lookups, so
    // letting two sheets share a name would silently corrupt later
    // BLOCKREF / cross-sheet resolution. Surface a notification to the
    // user via the host channel and abort so they can rename / save
    // the existing workbook before starting a new game.
    const existingNames = new Set(result.map((s) => s.name))
    const conflicts = SHEET_ORDER.filter((name) => existingNames.has(name))
    if (conflicts.length > 0) {
        notifyHost(
            'error',
            L.errors.sheetNameCollision(conflicts.join(', '))
        )
        throw new SheetNameCollisionError(conflicts)
    }
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
    // userEditable / validation shadow installation is now engine-
    // managed: declared as `editabilityFormulas` / `validationFormulas`
    // on the BindFormSchema payload below, then auto-installed by the
    // engine at bind time (and at every InsertRowsInBlock). The old
    // phase-3 collection sites are gone — leaving just a note here so
    // future readers don't reinvent the helper. See engine's
    // input_block_cell_shadow_template.
    // Per-sheet, per-column maximum width required by any block on that
    // sheet. Filled while we walk BLOCK_DEFS; emitted as setColWidth
    // payloads after the loop so each column ends up wide enough for every
    // block stacked on it.
    const requiredColWidth: Record<string, Map<number, number>> = {}
    // Per-sheet set of row indices that belong to any block — every such
    // row gets the uniform BLOCK_ROW_HEIGHT.
    const blockRows: Record<string, Set<number>> = {}

    // Phase-2 UpsertFieldFormulas inputs collected while walking
    // BLOCK_DEFS. Each entry installs one block's actual field formulas
    // once every block's phase-1 schema (refName + field set, no
    // formulas) is in place — by which point the parser can resolve
    // any cross-block BLOCKREF / BLOCKREFS regardless of declaration
    // order. See the comment at the in-loop bindFormSchema push.
    const phase2UpsertPayloads: Array<{
        sheetIdx: number
        blockId: number
        fieldFormulas: string[]
    }> = []

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
            // Col 0 is the key column — its cell values are the row keys
            // (supplier names, etc.), which can be wider than the field
            // header itself. Size by max(field name, longest key).
            const sizingName =
                fieldIdx === 0 && table.keys.length > 0
                    ? table.keys.reduce(
                          (longest, k) =>
                              k.length > longest.length ? k : longest,
                          field.name
                      )
                    : field.name
            const w = colWidthForFieldName(sizingName)
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

            // FieldInfo carries only host-UI metadata now (post-Phase-1+2):
            //   - valueFormula moved to Rust schema (BindFormSchema below)
            //   - userEditable as a string formula moved to Rust schema
            //     (editabilityFormulas in BindFormSchema below); the engine
            //     auto-installs the shadow and the host permission patch
            //     reads schema metadata to decide whether to consult it.
            // What stays on FieldInfo: the static boolean userEditable
            // flag (key column false; otherwise permissive — formula, if
            // any, dynamically tightens via shadow).
            const staticUserEditable: boolean =
                fieldIdx === 0
                    ? false
                    : typeof field.userEditable === 'string'
                    ? true
                    : field.userEditable
            const info = blockManager.fieldManager.create(sheetId, blockId, {
                name: field.name,
                type: fieldTypeSpec,
                required: false,
                unique: false,
                userEditable: staticUserEditable,
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

        // Two-phase BindFormSchema. PHASE 1: register the schema with
        // empty field_formulas so the refName resolves and the field-
        // axis ids are assigned, but no templated formula gets parsed
        // yet. PHASE 2 (emitted after the BLOCK_DEFS loop) rebinds
        // with the real field_formulas, by which point every
        // referenced block's refName / field set is registered — so
        // BLOCKREF / BLOCKREFS lookups resolve regardless of the
        // declaration order in BLOCK_DEFS. This breaks the cross-block
        // dependency cycle that single-pass binding can't satisfy
        // (e.g. PLC.本期产能 sums OrderConfiguration columns AND
        // OrderConfiguration.本期预计良品率 reads PLC fields).
        const fieldNames = fields.map((field) => field.name)
        const fieldFormulas = fields.map(
            (field) => field.valueFormula ?? ''
        )
        // Per-field validation / editability templates. Engine takes
        // ownership: it auto-installs `ShadowKind::Validation` /
        // `ShadowKind::UserEditable` shadows on every existing row at
        // BindFormSchema time, and on every newly-inserted row at
        // InsertRowsInBlock time. So we just declare them on the schema
        // and forget — no more per-row install helpers.
        //
        // editability comes from `userEditable` when it's a string (the
        // boolean form is a static UI flag, not a per-cell formula).
        // fields[0] is the key column — forced uneditable as always; we
        // skip its declared `userEditable` here just like we did for
        // fieldManager.create.
        const validationFormulas = fields.map(
            (field) => field.validation ?? ''
        )
        const editabilityFormulas = fields.map((field, fieldIdx) => {
            if (fieldIdx === 0) return ''
            const ue = field.userEditable
            return typeof ue === 'string' ? ue : ''
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
                .fields(fieldNames)
                .renderIds(renderIds)
                .fieldFormulas(fieldNames.map(() => ''))
                .validationFormulas(validationFormulas)
                .editabilityFormulas(editabilityFormulas)
                .build(),
        })
        // Stash phase-2 inputs so we can install field formulas after
        // every block has a registered schema. Skip blocks whose
        // fields are all free-form (no formula → no upsert needed).
        if (fieldFormulas.some((f) => f.trim() !== '')) {
            phase2UpsertPayloads.push({
                sheetIdx,
                blockId,
                fieldFormulas,
            })
        }

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
            writeConstant(CONST_KEY_CONSECUTIVE_LOSS, 0)
            writeConstant(CONST_KEY_CONSECUTIVE_NO_GOODWILL, 0)
            writeConstant(CONST_KEY_GAME_STATE, 'playing')
        }

        // Supplier tables: roll initial stats (良品率 / 单价) from the
        // seed and write them into the block. `每期最大供应` is gone —
        // suppliers now have unlimited capacity, so only yield and
        // price remain as differentiating stats.
        const supplierBase = SUPPLIER_BASE_STATS[table.refName]
        if (supplierBase) {
            const yieldCol = fields.findIndex((fi) => fi.name === REQUIRED_YIELD_RATE)
            const priceCol = fields.findIndex((fi) => fi.name === UNIT_PRICE)
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

        // PRODUCTION_LINE_CONTRIBUTION_TABLE: seed each material's two
        // supplier percentages to 0.5 / 0.5 — a neutral starting split
        // that matches the convention "two percentages of a material
        // sum to 1". The PercentAllocatorLayer overlay otherwise reads
        // blank cells as 0 and renders 0%/0% with nothing to click
        // from. 本期产能 stays blank — the player picks it per round.
        if (table === PRODUCTION_LINE_CONTRIBUTION_TABLE) {
            const supplierPairs: ReadonlyArray<readonly [string, string]> = [
                [OPTICAL_GLASS_SUPPLIER_1, OPTICAL_GLASS_SUPPLIER_2],
                [EQUATORIAL_MOUNT_SUPPLIER_1, EQUATORIAL_MOUNT_SUPPLIER_2],
                [METAL_FITTINGS_SUPPLIER_1, METAL_FITTINGS_SUPPLIER_2],
            ]
            keys.forEach((_keyName, rowIdx) => {
                for (const [s1, s2] of supplierPairs) {
                    const c1 = fields.findIndex((fi) => fi.name === s1)
                    const c2 = fields.findIndex((fi) => fi.name === s2)
                    if (c1 < 0 || c2 < 0) continue
                    for (const [col, val] of [
                        [c1, 0.5],
                        [c2, 0.5],
                    ] as const) {
                        blockPayloads.push({
                            type: 'blockInput',
                            value: new BlockInputBuilder()
                                .sheetIdx(sheetIdx)
                                .blockId(blockId)
                                .row(rowIdx)
                                .col(col)
                                .input(String(val))
                                .build(),
                        })
                    }
                }
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

        // Financial status: 资金 starts at ¥5000 — enough to cover the
        // first round's fixed costs but not so much that the player
        // can ignore cash flow. Bankruptcy is a real risk in rounds
        // 1-3 if they over-invest. 商誉 starts at 100 — the
        // reputation scalar (penalties shave -orderPenalty/100,
        // on-time completions add +1).
        if (table === FINANCIAL_STATUS_TABLE) {
            const valCol = fields.findIndex((fi) => fi.name === L.fields.value)
            if (valCol >= 0) {
                keys.forEach((keyName, rowIdx) => {
                    const seed =
                        keyName === GOODWILL
                            ? '100'
                            : keyName === FUND
                            ? '5000'
                            : undefined
                    if (seed === undefined) return
                    blockPayloads.push({
                        type: 'blockInput',
                        value: new BlockInputBuilder()
                            .sheetIdx(sheetIdx)
                            .blockId(blockId)
                            .row(rowIdx)
                            .col(valCol)
                            .input(seed)
                            .build(),
                    })
                })
            }
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
            const valueCol = fields.findIndex((fi) => fi.name === L.fields.value)
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
    //
    // Per-(sheet, col) minimum overrides ride on top of the field-name
    // calculation. MAIN-sheet col 0 holds the key column of every block
    // (一/二/生产线一/光学玻璃供应商一/etc.) — the row-key value can be
    // longer than the field-name "key" itself, so the auto-derived width
    // is too tight. Bump it.
    const MIN_COL_WIDTH_OVERRIDES: ReadonlyArray<[string, number, number]> = [
        [MAIN_SHEET, 0, 14],
    ]
    for (const [sheet, col, minW] of MIN_COL_WIDTH_OVERRIDES) {
        const cols =
            requiredColWidth[sheet] ??
            (requiredColWidth[sheet] = new Map<number, number>())
        const cur = cols.get(col) ?? 0
        if (minW > cur) cols.set(col, minW)
    }
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

    // PHASE 2 of the two-phase bind: install per-field formulas now
    // that every block's refName + field set is registered. Templates
    // parsed here can BLOCKREF / BLOCKREFS any other block in
    // BLOCK_DEFS irrespective of declaration order, which is what
    // makes e.g. cross-block circular refs (PLC.本期产能 →
    // OrderConfiguration, OrderConfiguration.本期预计良品率 → PLC)
    // possible to express as pure formulas.
    for (const item of phase2UpsertPayloads) {
        blockPayloads.push({
            type: 'upsertFieldFormulas',
            value: new UpsertFieldFormulasBuilder()
                .sheetIdx(item.sheetIdx)
                .blockId(item.blockId)
                .fieldFormulas(item.fieldFormulas)
                // Empty vec = "leave validation / editability templates
                // untouched". The engine learned about them at
                // BindFormSchema time (declared on each Field) and
                // already auto-installed the per-row shadows. Phase 2's
                // UpsertFieldFormulas is only updating value templates.
                .validationFormulas([])
                .editabilityFormulas([])
                .build(),
        })
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

    // Engine note: validation + userEditable shadows used to be
    // installed here (phases 3 and 3b) by walking BLOCK_DEFS and firing
    // installValidationShadowsForRows / installUserEditableShadowsForRows.
    // The engine now auto-installs both shadow kinds at BindFormSchema
    // time from the schema-level validation/editability templates we
    // pushed above, so the explicit phases are gone.

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

    // Phase 4 — generate round 1's order batch. Without this the
    // player opens a fresh game and sees an empty NewOrderStatus,
    // which forces an "advance to round 2 just to get orders" no-op
    // tick. Mirrors the order-generation block at the end of
    // advanceRound: same rng seeding pattern (root seed × round ×
    // index), same goodwill-scaling (here pinned to the baseline
    // since 商誉 was just seeded), same watchOrderAccepted wiring.
    const rootSeedU32 = rootSeedToU32(seed)
    const round1Orders: GeneratedOrder[] = []
    for (let i = 0; i < ORDERS_PER_ROUND; i++) {
        const orderRng = mulberry32(hashSeed(rootSeedU32, 1, i))
        const order = generateOrder(
            1,
            i,
            SALES_CAPACITY_PLACEHOLDER,
            GOODWILL_BASELINE,
            orderRng
        )
        round1Orders.push(order)
        // insertOrder grows the orderStatus block as needed and
        // installs the row's userEditable shadow for 是否接受 — same
        // path normal mid-game order arrivals use.
        await insertOrder(client, resolvedBlockIds, order)
        watchOrderAccepted(client, order.orderId, async (accepted) => {
            try {
                if (accepted) {
                    await insertOrderConfig(
                        client,
                        resolvedBlockIds,
                        order.orderId
                    )
                    await insertAcceptedOrder(
                        client,
                        resolvedBlockIds,
                        order,
                        1
                    )
                } else {
                    await removeOrderConfig(
                        client,
                        resolvedBlockIds,
                        order.orderId
                    )
                    await removeAcceptedOrder(
                        client,
                        resolvedBlockIds,
                        order.orderId
                    )
                }
            } catch (e) {
                console.warn(
                    `round-1 OrderConfiguration sync failed for ${order.orderId}:`,
                    e
                )
            }
        })
    }

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
async function readBlockRef(
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
async function tick(
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
interface GeneratedOrder {
    orderId: string
    amount: number
    deadlineRounds: number
    yieldRate: number // 0..1, displayed as '0.00%'
    unitPrice: number
    /**
     * Per-unit penalty (单位违约金) — currency owed per UNDELIVERED unit
     * once the deadline expires. Rolled at generation time as
     * `unitPrice × random integer in [1,3]` so penalty severity varies
     * per order. The actual penalty an order incurs = unitPenalty ×
     * undelivered count at deadline.
     */
    unitPenalty: number
    accepted: string // 是否接受 — '' until the player decides
}

/** Numeric prefix shared by every order id in a game. */
const ORDER_ID_PREFIX = 715

/**
 * Required yield rate scales with round so early game forgives sloppy
 * production and late game punishes it. Tweak the curve here.
 */
function orderQualityFromRound(round: number): number {
    return Math.min(0.99, 0.8 + 0.01 * round)
}

/**
 * Stand-in for the not-yet-modeled sales-department capability. The
 * constant pre-multiplies every order's amount; per-profile scale on
 * top means actual order sizes spread as:
 *   小单 ≈ 0.5 × SALES_CAPACITY_PLACEHOLDER  ≈ 10 units
 *   常规 ≈ 1.0 ×                              ≈ 20 units
 *   急单 ≈ 1.4 ×                              ≈ 28 units
 * Total demand per round ≈ 58 units, enough to cover both lines'
 * fixed costs even at default 50/50 supplier mix.
 */
const SALES_CAPACITY_PLACEHOLDER = 20
function orderAmountFromCapacity(capacity: number): number {
    return capacity
}

/** Defaults for the order fields. */
//
// Base unit price tuned to ~25% gross margin at 50/50 supplier mix:
//   Line 1 L1 unit cost ≈ 322 (materials 312 + per-unit 10),
//   fixed-cost amortized over max capacity adds ~10 → ~332/unit.
//   Margin at base 400 ≈ 68/unit (~17%).
// Player levers shift the margin:
//   - all-budget suppliers   → cost ~225  → margin ~175 (44%)  but
//     yield-shortfall + penalty risk
//   - all-premium suppliers  → cost ~415  → margin NEGATIVE unless
//     paired with high-yield orders that escape penalty
// Profile + goodwill scaling then layers on (×0.9 / ×1.0 / ×1.15
// for 小单/常规/急单, × goodwill/100 for reputation).
const ORDER_DEFAULT_UNIT_PRICE = 400

// ----------------------------------------------------------------------
// Order profiles
// ----------------------------------------------------------------------
// Each round, every order gets randomly assigned one of these profiles
// before per-attribute jitter is layered on top. The shapes pull
// orders apart along ALL the levers the player can read — amount,
// deadline, required yield, unit price, penalty severity — so three
// orders in the same round feel meaningfully different.
//
//   小单 — easy bread-and-butter: small, long deadline, low yield bar,
//          modest reward, modest penalty.
//   常规 — middle of the road: average everything.
//   急单 — high-stakes: bigger, tighter deadline, demanding yield,
//          bigger payout, scarier penalty.
//
// The profile is picked uniformly at random per order (not assigned by
// index), so a round might have three 急单 in a row, or three 小单,
// or anything in between. Forces the player to actually read the
// table each round instead of memorising positions.
interface OrderProfile {
    label: string
    amountScale: number // multiplies salesCapacity
    periodChoices: readonly number[] // sampled via rng
    yieldDelta: number // added to orderQualityFromRound(round)
    priceScale: number // multiplies ORDER_DEFAULT_UNIT_PRICE
    penaltyMultMin: number
    penaltyMultMax: number
}
const ORDER_PROFILES: readonly OrderProfile[] = [
    {
        label: L.orderProfiles.small,
        amountScale: 0.5,
        periodChoices: [3, 4],
        yieldDelta: -0.02,
        priceScale: 0.9,
        penaltyMultMin: 1,
        penaltyMultMax: 2,
    },
    {
        label: L.orderProfiles.normal,
        amountScale: 1.0,
        periodChoices: [3],
        yieldDelta: 0.0,
        priceScale: 1.0,
        penaltyMultMin: 1,
        penaltyMultMax: 3,
    },
    {
        label: L.orderProfiles.rush,
        amountScale: 1.4,
        periodChoices: [2],
        yieldDelta: 0.03,
        priceScale: 1.15,
        penaltyMultMin: 2,
        penaltyMultMax: 3,
    },
]

// 商誉 caps and the baseline used to interpret it as a quality
// multiplier. The game starts at 商誉=100 (= 1.0x scale on the
// goodwill-keyed dimensions). Successful deliveries push it up; failed
// ones push it down. The cap is enforced when advanceRound writes the
// new value back to FinancialStatus.
const GOODWILL_BASELINE = 100
const GOODWILL_MAX = 150
const GOODWILL_MIN = 0

/**
 * Linear quality multiplier derived from 商誉. Used by generateOrder
 * to scale order size and unit price — higher goodwill produces
 * higher-value orders. At 商誉=100 returns 1.0; at the 150 cap returns
 * 1.5; at 50 returns 0.5; below 0 clamps to a small positive floor so
 * the game can't generate literally-zero-amount orders.
 */
function goodwillQualityScale(goodwill: number): number {
    if (!Number.isFinite(goodwill)) return 1
    return Math.max(0.1, goodwill / GOODWILL_BASELINE)
}

/**
 * Build one order from the round number and its position within the
 * round. `salesCapacity` is the placeholder hook for the eventual
 * sales-department metric; default uses {@link SALES_CAPACITY_PLACEHOLDER}.
 *
 * `goodwill` ties order quality (amount + unit price) to the
 * factory's reputation: a 商誉=150 game produces orders with 1.5×
 * the amount and unit price vs. 商誉=100. Penalty per unit (rolled
 * 1–3× unit price) then scales naturally because it's a multiple of
 * the already-scaled unit price.
 */
function generateOrder(
    round: number,
    indexInRound: number,
    salesCapacity: number = SALES_CAPACITY_PLACEHOLDER,
    goodwill: number = GOODWILL_BASELINE,
    /**
     * Random number source. Pass a `mulberry32`-derived rng (seeded
     * from `hashSeed(rootSeed, round, indexInRound)`) for
     * deterministic replays; defaults to `Math.random` for legacy
     * callers / standalone usage.
     *
     * Call order inside this function is FIXED so deterministic
     * replays stay deterministic — adding new rolls anywhere but the
     * end will shift later values. Current order: profile pick →
     * amount jitter → price jitter → period choice → penalty mult.
     */
    rng: () => number = Math.random
): GeneratedOrder {
    const scale = goodwillQualityScale(goodwill)

    // 1) Pick a profile uniformly. Three profiles × goodwill-scaled
    //    base means each round has 3 quite different orders.
    const profile =
        ORDER_PROFILES[Math.floor(rng() * ORDER_PROFILES.length)] ??
        ORDER_PROFILES[0]

    // 2) Amount: base × profile × goodwill scale × small jitter
    //    (±15%) so even same-profile orders don't print identical
    //    numbers. Floor at 1 unit so the table never shows 0.
    const amountJitter = 0.85 + rng() * 0.3 // [0.85, 1.15]
    const amount = Math.max(
        1,
        Math.round(
            orderAmountFromCapacity(salesCapacity) *
                scale *
                profile.amountScale *
                amountJitter
        )
    )

    // 3) Unit price: base × profile × goodwill × jitter (±10%).
    const priceJitter = 0.9 + rng() * 0.2 // [0.9, 1.1]
    const unitPrice = Math.max(
        1,
        Math.round(
            ORDER_DEFAULT_UNIT_PRICE *
                scale *
                profile.priceScale *
                priceJitter
        )
    )

    // 4) Period: pick from this profile's allowed deadlines.
    const period =
        profile.periodChoices[
            Math.floor(rng() * profile.periodChoices.length)
        ] ?? profile.periodChoices[0]

    // 5) Required yield: round-based baseline + profile delta,
    //    clamped to [0.5, 0.99]. Tight rounds (low + harsh profile)
    //    can't tank below 50% — keeps the order plausibly winnable.
    const yieldBase = Math.min(
        0.99,
        Math.max(0.5, orderQualityFromRound(round) + profile.yieldDelta)
    )

    // 6) Penalty multiplier: profile-specific range.
    const multiplier =
        profile.penaltyMultMin +
        Math.floor(
            rng() *
                (profile.penaltyMultMax - profile.penaltyMultMin + 1)
        )

    // 7) Yield jitter — appended at the END so the rolls above keep
    //    their deterministic positions for replay. Without this every
    //    same-profile order in the same round prints the IDENTICAL
    //    required-yield (profiles only span ~0.05); five orders look
    //    visually duplicated. ±0.05 spread + 2-decimal rounding makes
    //    each order's bar look distinct while staying in the same
    //    difficulty band.
    const yieldJitter = (rng() - 0.5) * 0.1 // [-0.05, +0.05]
    const yieldRate =
        Math.round(
            Math.min(0.99, Math.max(0.5, yieldBase + yieldJitter)) * 100
        ) / 100

    return {
        orderId: `${ORDER_ID_PREFIX}-${round}-${indexInRound}`,
        amount,
        deadlineRounds: period,
        yieldRate,
        unitPrice,
        unitPenalty: unitPrice * multiplier,
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
        [L.fields.periods]: String(order.deadlineRounds),
        [REQUIRED_YIELD_RATE]: String(order.yieldRate),
        [UNIT_PRICE]: String(order.unitPrice),
        [UNIT_PENALTY]: String(order.unitPenalty),
        [L.fields.isAccepted]: order.accepted,
    }
}

/**
 * Write `order` into the next available row of NEW_ORDER_STATUS_TABLE,
 * growing the block (and shifting downstream blocks on the sheet) as
 * needed. Returns the row index inside the block where the order landed.
 */
async function insertOrder(
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

    // No explicit shadow install — the engine's InsertRowsInBlock arm
    // auto-installs validation + userEditable shadows for the freshly-
    // grown row from the schema-level templates declared at
    // BindFormSchema time. Was: installUserEditableShadowsForRows +
    // installValidationShadowsForRows for [absoluteRow].
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
async function insertOrderConfig(
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
        (f) => f.name === L.fields.order
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
        (f) => f.name === L.fields.order
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
    // Validation shadows for the freshly-grown row are auto-installed
    // by the engine's InsertRowsInBlock arm — no explicit follow-up
    // tx needed. Was: installValidationShadowsForRows([absoluteRow],
    // temp:true).
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
async function removeOrderConfig(
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
        (f) => f.name === L.fields.order
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
async function insertAcceptedOrder(
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

    // Column → literal value for non-templated fields. 剩余期数 is
    // templated (valueFormula) so it's skipped here.
    const valueByName: Record<string, string> = {
        [ORDER_ID]: order.orderId,
        [REQUIRED_AMOUNT]: String(order.amount),
        [L.fields.periods]: String(order.deadlineRounds),
        [REQUIRED_YIELD_RATE]: String(order.yieldRate),
        [UNIT_PRICE]: String(order.unitPrice),
        [UNIT_PENALTY]: String(order.unitPenalty),
        [L.fields.acceptedRound]: String(acceptedRound),
        // 已交付数量 starts at 0 — advanceRound bumps it each round.
        // Writing the literal "0" (vs. leaving blank) keeps the
        // OrderConfiguration.剩余交付数 BLOCKREF arithmetic clean.
        [L.fields.deliveredAmount]: '0',
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

async function removeAcceptedOrder(
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
async function watchByBlockRef(
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
function watchOrderAccepted(
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
        if (e.fieldName !== L.fields.isAccepted) return
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
function installProductionLineUpgradeBridge(client: Client): void {
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
function installJointResearchBridge(client: Client): void {
    if (_jointResearchBridgeInstalled) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onBlockCellEdit = (window as any).onBlockCellEdit as
        | ((cb: (e: BlockCellEditEvent) => void) => () => void)
        | undefined
    if (!onBlockCellEdit) return
    _jointResearchBridgeInstalled = true

    const yieldCol = SUPPLIER_FIELDS.findIndex((f) => f.name === REQUIRED_YIELD_RATE)
    const priceCol = SUPPLIER_FIELDS.findIndex((f) => f.name === UNIT_PRICE)
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
async function clearAllOrders(
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
const ORDERS_PER_ROUND = 5

/**
 * One round transition: dispose last round's order subscriptions, clear
 * last round's orders, bump the round counter, generate this round's
 * orders, insert each, and (optionally) subscribe to its 是否接受 cell.
 *
 * The `onOrderAccepted` callback fires once per order when the player
 * clicks the 是否接受 cell — receives the order and the chosen boolean.
 */
/**
 * Per-round financial + reputation breakdown returned by
 * `advanceRound`. The host uses this to render the round summary
 * dialog and the running status bar without having to re-read the
 * sheet. Sign convention matches FinancialImpact's cells: costs are
 * negative, revenue positive, goodwill delta signed (±1 or
 * −penalty/100). `netCashDelta` is the sum that was applied to 资金;
 * `goodwillDelta` is the sum applied to 商誉.
 */
interface RoundSummary {
    round: number
    orders: readonly GeneratedOrder[]
    /** Map of FinancialImpact key → its '值' for this round. */
    breakdownByKey: Record<string, number>
    /** Net cash change applied to 资金 (excludes 商誉变化). */
    netCashDelta: number
    /** Goodwill change applied to 商誉 (already clamped to [0,150]). */
    goodwillDelta: number
    fundBefore: number
    fundAfter: number
    goodwillBefore: number
    goodwillAfter: number
    /** Post-tick game state. `'playing'` means continue; anything
     *  else is a terminal state and `tick` should refuse further
     *  advances. */
    gameState: GameState
    /** True if `gameState` flipped from 'playing' on this tick. The
     *  host UI uses this to decide whether to surface the ending
     *  modal alongside the regular round-summary. */
    gameStateChanged: boolean
}

async function advanceRound(
    client: Client,
    blockIds: BlockIds,
    onOrderAccepted?: (order: GeneratedOrder, accepted: boolean) => void
): Promise<RoundSummary> {
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

    // Pre-flight: hard-reject the round if any production line is
    // over-allocated (本期产能 > 最大生产数) BEFORE we commit the
    // temp branch. If the check throws here, the player's
    // accept-toggles + per-order allocations stay live on the temp
    // branch — they can adjust allocations and click "下一轮" again
    // without re-accepting every order. Committing first and THEN
    // checking would lose that "still in editing" state on failure.
    //
    // getBlockInfo sees the current visible state (canonical +
    // active temp overlay), which is exactly what the player sees,
    // so 本期产能's templated SUM(BLOCKREFS(OrderConfiguration,...))
    // reflects the in-progress allocations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wb = client as any
    {
        const sheetIdForCheck = await client.getSheetId({sheetIdx: mainSheetIdx})
        if (isErrorMessage(sheetIdForCheck))
            throw new Error(
                `getSheetId(MAIN) failed: ${JSON.stringify(sheetIdForCheck)}`
            )
        const [plInfoPre, plcInfoPre] = await Promise.all([
            client.getBlockInfo({
                sheetId: sheetIdForCheck,
                blockId: blockIds.productionLine,
            }),
            client.getBlockInfo({
                sheetId: sheetIdForCheck,
                blockId: blockIds.productionLineContribution,
            }),
        ])
        if (isErrorMessage(plInfoPre))
            throw new Error(
                `getBlockInfo(productionLine) failed: ${JSON.stringify(plInfoPre)}`
            )
        if (isErrorMessage(plcInfoPre))
            throw new Error(
                `getBlockInfo(productionLineContribution) failed: ${JSON.stringify(plcInfoPre)}`
            )
        const plMaxColIdxPre = PRODUCTION_LINE_TABLE.fields.findIndex(
            (f) => f.name === MAX_PRODUCTION
        )
        const plcCapColIdxPre =
            PRODUCTION_LINE_CONTRIBUTION_TABLE.fields.findIndex(
                (f) => f.name === CAPACITY
            )
        if (plMaxColIdxPre >= 0 && plcCapColIdxPre >= 0) {
            const maxByKey = new Map<string, number>()
            for (let r = 0; r < plInfoPre.rowCnt; r++) {
                const key = cellValueAsString(
                    plInfoPre.cells[r * plInfoPre.colCnt + 0]?.value
                )
                const max = numericCellValue(
                    plInfoPre.cells[r * plInfoPre.colCnt + plMaxColIdxPre]
                        ?.value
                )
                if (key) maxByKey.set(key, max)
            }
            const overAllocations: string[] = []
            for (let r = 0; r < plcInfoPre.rowCnt; r++) {
                const key = cellValueAsString(
                    plcInfoPre.cells[r * plcInfoPre.colCnt + 0]?.value
                )
                const cap = numericCellValue(
                    plcInfoPre.cells[r * plcInfoPre.colCnt + plcCapColIdxPre]
                        ?.value
                )
                const max = maxByKey.get(key)
                if (max !== undefined && Number.isFinite(cap) && cap > max) {
                    overAllocations.push(
                        `${PRODUCTION_LINE} ${key}: ${CAPACITY} ${cap} > ${MAX_PRODUCTION} ${max}`
                    )
                }
            }
            if (overAllocations.length > 0) {
                // Throw BEFORE commitTempStatus — temp branch survives.
                throw new Error(
                    L.errors.overCapacity(overAllocations.join('\n  · '))
                )
            }
        }
    }

    // Pre-check passed. Now commit any active temp branch. The host
    // runs in temp mode, so the player's accept-toggles (which fan
    // out to insertOrderConfig + insertAcceptedOrder, both temp:true)
    // live on the temp branch. If we ran our non-temp round tx
    // without committing, the engine's "non-temp tx discards any
    // active temp branch" rule would wipe every accepted order
    // before advancing. commitTempStatus folds those edits into
    // canonical state so they survive round advance — and
    // getBlockInfo below sees the same view our payloads target.
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
        financialImpactInfo,
        financialStatusInfo,
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
        client.getBlockInfo({
            sheetId: mainSheetId,
            blockId: blockIds.financialImpact,
        }),
        client.getBlockInfo({
            sheetId: mainSheetId,
            blockId: blockIds.financialStatus,
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
    if (isErrorMessage(financialImpactInfo))
        throw new Error(
            `getBlockInfo(financialImpact) failed: ${JSON.stringify(
                financialImpactInfo
            )}`
        )
    if (isErrorMessage(financialStatusInfo))
        throw new Error(
            `getBlockInfo(financialStatus) failed: ${JSON.stringify(
                financialStatusInfo
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

    // Read root seed from Constants.seed so order generation can
    // derive deterministic per-(round, index) rngs. Written once at
    // newGame as Math.random() — replays from this point on are
    // reproducible given the same seed cell.
    const seedRowIdx = CONSTANTS_TABLE.keys.indexOf('seed')
    const seedCell =
        constantsInfo.cells[
            seedRowIdx * constantsInfo.colCnt + roundValueColIdx
        ]
    const rootSeedFloat = numericCellValue(seedCell?.value)
    const rootSeedU32 = rootSeedToU32(rootSeedFloat)

    // Campaign-state reads. evaluateEndgame later combines these with
    // the post-tick fund/goodwill to advance the lose-streak counters
    // and decide if the campaign has ended.
    const consecLossRowIdx = CONSTANTS_TABLE.keys.indexOf(
        CONST_KEY_CONSECUTIVE_LOSS
    )
    const consecNoGwRowIdx = CONSTANTS_TABLE.keys.indexOf(
        CONST_KEY_CONSECUTIVE_NO_GOODWILL
    )
    const gameStateRowIdx = CONSTANTS_TABLE.keys.indexOf(
        CONST_KEY_GAME_STATE
    )
    const prevConsecLossRaw = numericCellValue(
        constantsInfo.cells[
            consecLossRowIdx * constantsInfo.colCnt + roundValueColIdx
        ]?.value
    )
    const prevConsecNoGwRaw = numericCellValue(
        constantsInfo.cells[
            consecNoGwRowIdx * constantsInfo.colCnt + roundValueColIdx
        ]?.value
    )
    const prevGameState =
        (cellValueAsString(
            constantsInfo.cells[
                gameStateRowIdx * constantsInfo.colCnt + roundValueColIdx
            ]?.value
        ) as GameState) || 'playing'
    if (prevGameState !== 'playing') {
        throw new Error(
            `advanceRound: game already ended (${prevGameState}). Start a new game first.`
        )
    }
    const prevConsecLoss = Number.isFinite(prevConsecLossRaw)
        ? prevConsecLossRaw
        : 0
    const prevConsecNoGw = Number.isFinite(prevConsecNoGwRaw)
        ? prevConsecNoGwRaw
        : 0

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
        (fi) => fi.name === L.fields.order
    )
    // Player's raw allocation = units delivered this round.
    const ocCurDeliveryCol = ORDER_CONTRIBUTION_TABLE.fields.findIndex(
        (fi) => fi.name === CURRENT_DELIVERY
    )
    const accOrderIdCol = ACCEPTED_ORDER_STATUS_TABLE.fields.findIndex(
        (fi) => fi.name === ORDER_ID
    )
    const accDeliveredCol = ACCEPTED_ORDER_STATUS_TABLE.fields.findIndex(
        (fi) => fi.name === L.fields.deliveredAmount
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
    //     ProductionLineContribution[L].本期产能
    //       × ProductionLineContribution[L].S_pct
    //
    // 本期产能 is now an absolute unit count for the round (was a
    // 0..1 fraction multiplied by ProductionLine.最大生产数 to get
    // units; that multiplication is gone). per-supplier % live in
    // PRODUCTION_LINE_CONTRIBUTION_TABLE. Multiply and accumulate
    // into SupplierAccumulator.
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
        plcCapacityCol >= 0 &&
        accColIdx >= 0 &&
        PRODUCTION_LINE_TABLE.keys.length ===
            PRODUCTION_LINE_CONTRIBUTION_TABLE.keys.length
    ) {
        // Snapshot the per-line capacity + supplier % grid for the
        // pure helper. Skip rows whose capacity is NaN — they
        // contribute nothing.
        const lines: LineContribution[] = []
        const lineRowCnt = PRODUCTION_LINE_TABLE.keys.length
        for (let lineRow = 0; lineRow < lineRowCnt; lineRow++) {
            const capacity = numericCellValue(
                productionLineContribInfo.cells[
                    lineRow * productionLineContribInfo.colCnt + plcCapacityCol
                ]?.value
            )
            const supplierPcts: Record<string, number> = {}
            for (const [supplier, col] of supplierCols) {
                if (col < 0) continue
                const pct = numericCellValue(
                    productionLineContribInfo.cells[
                        lineRow * productionLineContribInfo.colCnt + col
                    ]?.value
                )
                if (Number.isFinite(pct)) supplierPcts[supplier] = pct
            }
            lines.push({capacity, supplierPcts})
        }
        const perSupplierThisRound = computeSupplierAccumulatorDeltas(lines)

        // Write back into SupplierAccumulator. Iterate the actual
        // accumulator block to find the matching row by current key
        // value — robust to row-reordering.
        const accSupplierCol = SUPPLIER_ACCUMULATOR_TABLE.fields.findIndex(
            (fi) => fi.name === L.fields.supplier
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

    // (2a-ter) Apply FinancialImpact to 资金 + 商誉.
    //
    // Both 订单罚款 and 商誉变化 are now formula-driven (deadline-
    // gated per-row helpers in OrderConfiguration summed via
    // BLOCKREFS). The engine already has the right value in those
    // cells at this read time — no JS-side settlement loop, no
    // override writes. We just read the column, add it up (FUND
    // excludes 商誉变化), and write back.
    const finImpactValueCol = FINANCIAL_IMPACT_TABLE.fields.findIndex(
        (fi) => fi.name === L.fields.value
    )
    // Snapshot the column. 订单罚款 + 商誉变化 are formula cells now,
    // so their value reads correctly without any JS override.
    const finImpactRows: FinancialImpactRow[] = []
    if (finImpactValueCol >= 0) {
        for (let r = 0; r < financialImpactInfo.rowCnt; r++) {
            finImpactRows.push({
                key: FINANCIAL_IMPACT_TABLE.keys[r],
                value: numericCellValue(
                    financialImpactInfo.cells[
                        r * financialImpactInfo.colCnt + finImpactValueCol
                    ]?.value
                ),
            })
        }
    }
    const rollup = computeFinancialRollup(
        finImpactRows,
        // No overrides — every key is a live formula now.
        {},
        // 商誉变化 is the only key kept out of the cash sum: it
        // applies to 商誉, not 资金.
        new Set([FIN_GOODWILL_DELTA])
    )
    const breakdownByKey = rollup.breakdownByKey
    const financialImpactTotal = rollup.total
    const goodwillDelta = breakdownByKey[FIN_GOODWILL_DELTA] ?? 0

    const fundValueCol = FINANCIAL_STATUS_TABLE.fields.findIndex(
        (fi) => fi.name === L.fields.value
    )
    const fundRowIdx = FINANCIAL_STATUS_TABLE.keys.indexOf(FUND)
    let baseFund = 0
    let nextFund = 0
    if (fundValueCol >= 0 && fundRowIdx >= 0) {
        const curFund = numericCellValue(
            financialStatusInfo.cells[
                fundRowIdx * financialStatusInfo.colCnt + fundValueCol
            ]?.value
        )
        baseFund = Number.isFinite(curFund) ? curFund : 0
        nextFund = baseFund + financialImpactTotal
        payloads.push({
            type: 'blockInput',
            value: new BlockInputBuilder()
                .sheetIdx(mainSheetIdx)
                .blockId(blockIds.financialStatus)
                .row(fundRowIdx)
                .col(fundValueCol)
                .input(String(nextFund))
                .build(),
        })
    }

    // Apply 商誉 delta. Read current 商誉 and add this round's delta,
    // clamped to [GOODWILL_MIN, GOODWILL_MAX]. Off-deadline rounds
    // leave goodwillDelta == 0; we still emit a write so the cell
    // visibly stays in sync (a no-op value-wise).
    const goodwillRowIdx = FINANCIAL_STATUS_TABLE.keys.indexOf(GOODWILL)
    let nextGoodwill = GOODWILL_BASELINE
    let baseGoodwill = GOODWILL_BASELINE
    if (fundValueCol >= 0 && goodwillRowIdx >= 0) {
        const curGoodwill = numericCellValue(
            financialStatusInfo.cells[
                goodwillRowIdx * financialStatusInfo.colCnt + fundValueCol
            ]?.value
        )
        baseGoodwill = Number.isFinite(curGoodwill)
            ? curGoodwill
            : GOODWILL_BASELINE
        nextGoodwill = clampGoodwill(
            baseGoodwill,
            goodwillDelta,
            GOODWILL_MIN,
            GOODWILL_MAX
        )
        payloads.push({
            type: 'blockInput',
            value: new BlockInputBuilder()
                .sheetIdx(mainSheetIdx)
                .blockId(blockIds.financialStatus)
                .row(goodwillRowIdx)
                .col(fundValueCol)
                .input(String(nextGoodwill))
                .build(),
        })
    }

    // (2a-quad) Evaluate campaign state. Uses the post-tick fund &
    // goodwill we just computed (the writes are still pending in
    // `payloads`, but the values are already finalised in JS). Decides
    // whether the campaign continues, ends in a win tier, or ends
    // because the player ran the streak counters past the grace
    // window.
    const endgame = evaluateEndgame(
        {
            round: currentRound,
            fund: nextFund,
            goodwill: nextGoodwill,
            consecutiveLossRoundsBefore: prevConsecLoss,
            consecutiveNoGoodwillRoundsBefore: prevConsecNoGw,
        },
        {
            maxRounds: MAX_ROUNDS,
            bankruptcyGraceRounds: BANKRUPTCY_GRACE_ROUNDS,
            reputationGraceRounds: REPUTATION_GRACE_ROUNDS,
            tierUltimateGoodwill: TIER_ULTIMATE_GOODWILL,
            tierGoldFund: TIER_GOLD_FUND,
            tierGoldGoodwill: TIER_GOLD_GOODWILL,
            tierSilverFund: TIER_SILVER_FUND,
            tierSilverGoodwill: TIER_SILVER_GOODWILL,
        }
    )
    const constValColIdx = roundValueColIdx
    const writeConstantPayload = (rowIdx: number, value: string | number) => {
        if (rowIdx < 0) return
        payloads.push({
            type: 'blockInput',
            value: new BlockInputBuilder()
                .sheetIdx(engineSheetIdx)
                .blockId(blockIds.constants)
                .row(rowIdx)
                .col(constValColIdx)
                .input(String(value))
                .build(),
        })
    }
    writeConstantPayload(
        consecLossRowIdx,
        endgame.consecutiveLossRoundsAfter
    )
    writeConstantPayload(
        consecNoGwRowIdx,
        endgame.consecutiveNoGoodwillRoundsAfter
    )
    writeConstantPayload(gameStateRowIdx, endgame.gameState)
    const gameEnded = endgame.gameState !== 'playing'

    // (2b) Bump the round counter on the constants table. SKIP when
    // the game just ended — there's no "next round". The round cell
    // stays at currentRound so the ending UI can show "你坚持到了第
    // N 回合" without us having to re-derive it.
    if (!gameEnded) {
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
    }

    // ============================================================
    // From here on, work is "set up the NEXT round". Skip entirely
    // when the game just ended — the player can't take another turn.
    // ============================================================
    if (gameEnded) {
        const tx = await client.handleTransaction({
            transaction: {payloads, undoable: true, temp: false},
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txStatus = (tx as any)?.status
        if (isErrorMessage(tx) || (txStatus && txStatus.type === 'err')) {
            throw new Error(
                `advanceRound (endgame) transaction failed at round ${currentRound}: ` +
                    JSON.stringify(tx)
            )
        }
        return {
            // Don't bump — surface the round that just closed so the
            // ending modal can say "你坚持到了第 N 回合".
            round: currentRound,
            orders: [],
            breakdownByKey,
            netCashDelta: financialImpactTotal,
            goodwillDelta,
            fundBefore: baseFund,
            fundAfter: nextFund,
            goodwillBefore: baseGoodwill,
            goodwillAfter: nextGoodwill,
            gameState: endgame.gameState,
            gameStateChanged: true,
        }
    }

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
        (fi) => fi.name === L.fields.order
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
    const supYieldCol = SUPPLIER_FIELDS.findIndex((fi) => fi.name === REQUIRED_YIELD_RATE)
    const supPriceCol = SUPPLIER_FIELDS.findIndex((fi) => fi.name === UNIT_PRICE)
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
        // Per-order rng seeded from (rootSeed, nextRound, i). Each
        // order's rolls are independent, so adding a future rng()
        // call to generateOrder won't shift later orders' values —
        // they're keyed by index, not by call order through one
        // shared stream.
        const orderRng = mulberry32(hashSeed(rootSeedU32, nextRound, i))
        // Quality scales with 商誉 — pass the just-clamped post-update
        // value so the orders the player sees next round reflect the
        // reputation hit/boost they just earned.
        const order = generateOrder(
            nextRound,
            i,
            SALES_CAPACITY_PLACEHOLDER,
            nextGoodwill,
            orderRng
        )
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

    // (6) Cleanup pass: drop orders that are now done — either fully
    // delivered (新 已交付数量 ≥ 数量) or past their deadline (next
    // round > 期数 + 接单回合). The penalty + goodwill formulas
    // already settled their contribution during the main tx (they
    // read pre-cleanup snapshot), so removing the rows AFTER that
    // commit is safe. Re-reading the blocks here picks up the
    // accumulator step's writes from the main tx.
    try {
        const accNew = await client.getBlockInfo({
            sheetId: mainSheetId,
            blockId: blockIds.acceptedOrderStatus,
        })
        if (!isErrorMessage(accNew)) {
            const idCol = ACCEPTED_ORDER_STATUS_TABLE.fields.findIndex(
                (fi) => fi.name === ORDER_ID
            )
            const amtCol = ACCEPTED_ORDER_STATUS_TABLE.fields.findIndex(
                (fi) => fi.name === REQUIRED_AMOUNT
            )
            const deliveredCol = ACCEPTED_ORDER_STATUS_TABLE.fields.findIndex(
                (fi) => fi.name === L.fields.deliveredAmount
            )
            const periodCol = ACCEPTED_ORDER_STATUS_TABLE.fields.findIndex(
                (fi) => fi.name === L.fields.periods
            )
            const acceptRoundCol =
                ACCEPTED_ORDER_STATUS_TABLE.fields.findIndex(
                    (fi) => fi.name === L.fields.acceptedRound
                )
            const toRemove: string[] = []
            if (
                idCol >= 0 &&
                amtCol >= 0 &&
                deliveredCol >= 0 &&
                periodCol >= 0 &&
                acceptRoundCol >= 0
            ) {
                const cc = accNew.colCnt
                for (let r = 0; r < accNew.rowCnt; r++) {
                    const orderId = cellValueAsString(
                        accNew.cells[r * cc + idCol]?.value
                    )
                    if (!orderId) continue
                    const amount = numericCellValue(
                        accNew.cells[r * cc + amtCol]?.value
                    )
                    const delivered = numericCellValue(
                        accNew.cells[r * cc + deliveredCol]?.value
                    )
                    const period = numericCellValue(
                        accNew.cells[r * cc + periodCol]?.value
                    )
                    const acceptRound = numericCellValue(
                        accNew.cells[r * cc + acceptRoundCol]?.value
                    )
                    const fullyDelivered =
                        Number.isFinite(amount) &&
                        Number.isFinite(delivered) &&
                        delivered >= amount
                    const expired =
                        Number.isFinite(period) &&
                        Number.isFinite(acceptRound) &&
                        period + acceptRound < nextRound
                    if (fullyDelivered || expired) toRemove.push(orderId)
                }
            }
            for (const orderId of toRemove) {
                try {
                    await removeOrderConfig(client, blockIds, orderId)
                    await removeAcceptedOrder(client, blockIds, orderId)
                } catch (e) {
                    console.warn(
                        `advance cleanup failed for ${orderId}:`,
                        e
                    )
                }
            }
        }
    } catch (e) {
        console.warn('advance cleanup pass failed:', e)
    }

    return {
        round: nextRound,
        orders,
        breakdownByKey,
        netCashDelta: financialImpactTotal,
        goodwillDelta,
        fundBefore: baseFund,
        fundAfter: nextFund,
        goodwillBefore: baseGoodwill,
        goodwillAfter: nextGoodwill,
        // Game is continuing (we exited the gameEnded branch above).
        // `gameStateChanged` stays false — nothing flipped this tick.
        gameState: 'playing',
        gameStateChanged: false,
    }
}

    return {
        ENGINE_SHEET,
        MAIN_SHEET,
        SALES_DEPARTMENT,
        PLANT,
        PROCUREMENT,
        OPTICAL_GLASS_SUPPLIER_1,
        OPTICAL_GLASS_SUPPLIER_2,
        EQUATORIAL_MOUNT_SUPPLIER_1,
        EQUATORIAL_MOUNT_SUPPLIER_2,
        METAL_FITTINGS_SUPPLIER_1,
        METAL_FITTINGS_SUPPLIER_2,
        EXPECTED_YIELD_RATE,
        REQUIRED_YIELD_RATE,
        CURRENT_EXPECTED_YIELD_RATE,
        DELIVERED_YIELD_RATE,
        DELIVERY_DEADLINE,
        CURRENT_DELIVERY,
        REMAINING_DELIVERY,
        CURRENT_REVENUE,
        UNIT_PENALTY,
        CURRENT_PENALTY,
        CURRENT_QUALITY_PENALTY,
        CURRENT_GOODWILL_CHANGE,
        REQUIRED_AMOUNT,
        UNIT_COST,
        UNIT_PRICE,
        PRODUCTION_LINE,
        PRODUCTION_LINE_1,
        PRODUCTION_LINE_2,
        FIXED_COST,
        MAX_PRODUCTION,
        PER_UNIT_COST,
        YIELD_ADJUSTMENT,
        LEVEL,
        WILL_UPGRADE,
        UPGRADE_COST,
        ACCUMULATED_SUPPLY,
        RESEARCH_COUNT,
        JOINT_RESEARCH,
        RESEARCH_THRESHOLD,
        RESEARCH_TIER,
        LAST_RESEARCH_ROUND,
        BASELINE_YIELD,
        BASELINE_PRICE,
        RESEARCH_ENUM_ID,
        RESEARCH_PRECISION_ID,
        RESEARCH_COST_ID,
        RESEARCH_BALANCED_ID,
        RESEARCH_TIER_THRESHOLDS,
        RESEARCH_EFFECTS,
        CAPACITY,
        TOTAL_COST,
        ORDER_ID,
        SUPPLIER_FIELDS,
        CASH,
        FIN_PRODUCTION_LINE_1_COST,
        FIN_PRODUCTION_LINE_2_COST,
        FIN_OPTICAL_GLASS_COST,
        FIN_EQUATORIAL_MOUNT_COST,
        FIN_METAL_FITTINGS_COST,
        FIN_GOODWILL_DELTA,
        FIN_ORDER_REVENUE,
        FIN_ORDER_PENALTY,
        FIN_QUALITY_PENALTY,
        FIN_PRODUCTION_LINE_1_UPGRADE,
        FIN_PRODUCTION_LINE_2_UPGRADE,
        FUND,
        GOODWILL,
        CONST_KEY_CONSECUTIVE_LOSS,
        CONST_KEY_CONSECUTIVE_NO_GOODWILL,
        CONST_KEY_GAME_STATE,
        CONSTANTS_TABLE,
        MAX_ROUNDS,
        BANKRUPTCY_GRACE_ROUNDS,
        REPUTATION_GRACE_ROUNDS,
        TIER_ULTIMATE_GOODWILL,
        TIER_GOLD_FUND,
        TIER_GOLD_GOODWILL,
        TIER_SILVER_FUND,
        TIER_SILVER_GOODWILL,
        OPTICAL_GLASS_SUPPLIERS_TABLE,
        EQUATORIAL_MOUNT_SUPPLIERS_TABLE,
        METAL_FITTINGS_SUPPLIERS_TABLE,
        PRODUCTION_LINE_LEVEL_KEYS,
        PRODUCTION_LINE_1_LEVELS_TABLE,
        PRODUCTION_LINE_2_LEVELS_TABLE,
        PRODUCTION_LINE_TABLE,
        PRODUCTION_LINE_CONTRIBUTION_TABLE,
        ORDER_CONTRIBUTION_TABLE,
        NEW_ORDER_STATUS_TABLE,
        ACCEPTED_ORDER_STATUS_TABLE,
        FINANCIAL_IMPACT_TABLE,
        FINANCIAL_STATUS_TABLE,
        CONSTRAINTS,
        ALL_SUPPLIER_NAMES,
        SUPPLIER_ACCUMULATOR_TABLE,
        RESEARCH_TIERS_TABLE,
        createSheet,
        SHEET_ORDER,
        SHEET_IDX,
        mulberry32,
        hashSeed,
        installUserEditableShadowsForRows,
        installValidationShadowsForRows,
        getGameStatus,
        clearValidationMonitorState,
        refreshValidationSubscriptions,
        notifyHost,
        SheetNameCollisionError,
        newGame,
        readBlockRef,
        tick,
        ORDER_ID_PREFIX,
        orderQualityFromRound,
        SALES_CAPACITY_PLACEHOLDER,
        orderAmountFromCapacity,
        GOODWILL_BASELINE,
        GOODWILL_MAX,
        GOODWILL_MIN,
        generateOrder,
        insertOrder,
        insertOrderConfig,
        removeOrderConfig,
        insertAcceptedOrder,
        removeAcceptedOrder,
        watchByBlockRef,
        watchOrderAccepted,
        installProductionLineUpgradeBridge,
        installJointResearchBridge,
        clearAllOrders,
        ORDERS_PER_ROUND,
        advanceRound,
    }
}
