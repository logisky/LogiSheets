// Pure helpers carved out of `advanceRound`. The engine.ts side reads
// block snapshots and hands typed records to these — no client / no
// engine state / no payload emission. Lets us hammer the
// penalty/goodwill/rollup logic with vitest without spinning up a
// workbook.

// ----------------------------------------------------------------------
// Penalty + goodwill rollup
// ----------------------------------------------------------------------

export interface AcceptedOrderRow {
    orderId: string
    /** 数量 — the original order size. */
    amount: number
    /** 期数 — number of rounds allowed to deliver. */
    period: number
    /** 接单回合 — round the player accepted the order. */
    acceptedRound: number
    /** 已交付数量 — cumulative units delivered across past rounds. */
    delivered: number
    /** 单位违约金 — penalty per undelivered unit at deadline. */
    unitPenalty: number
}

export interface OrderContributionRow {
    orderId: string
    /** 本期交付数 — units the player allocated to deliver this round. */
    currentDelivery: number
}

export interface RoundPenaltyEntry {
    orderId: string
    /** Units the order failed to deliver by its deadline (≥ 0). */
    undelivered: number
    /** Penalty owed for this order (positive currency). */
    orderPenalty: number
    /** Reputation change for this order: +1 on-time, −penalty/100 on failure. */
    goodwillChange: number
}

export interface RoundPenaltyGoodwill {
    /** Sum of all per-order penalties (POSITIVE currency). The caller
     *  negates this when writing to FinancialImpact for the signed
     *  convention. */
    roundPenaltyAmount: number
    /** Signed reputation delta to apply to 商誉. */
    goodwillDelta: number
    perOrder: ReadonlyArray<RoundPenaltyEntry>
}

/**
 * Settle the round's order penalties + reputation. An order at its
 * deadline (period + acceptedRound === currentRound) either:
 *   - delivered everything by end of this round  →  +1 商誉
 *   - left units undelivered                     →  penalty + goodwill loss
 *
 * Orders not at their deadline contribute nothing — they still have
 * time to deliver, so charging now would double-count.
 */
export function computeRoundPenaltyAndGoodwill(
    acceptedOrders: ReadonlyArray<AcceptedOrderRow>,
    contributions: ReadonlyArray<OrderContributionRow>,
    currentRound: number
): RoundPenaltyGoodwill {
    // Index this round's deliveries by orderId so the per-order
    // lookup stays O(1). Orders without a contribution row default
    // to 0 delivery (player didn't allocate anything this round).
    const deliveryByOrder = new Map<string, number>()
    for (const c of contributions) {
        if (!c.orderId) continue
        if (!Number.isFinite(c.currentDelivery)) continue
        deliveryByOrder.set(c.orderId, c.currentDelivery)
    }

    let roundPenaltyAmount = 0
    let goodwillDelta = 0
    const perOrder: RoundPenaltyEntry[] = []

    for (const o of acceptedOrders) {
        if (!o.orderId) continue
        if (!Number.isFinite(o.period) || !Number.isFinite(o.acceptedRound))
            continue
        if (o.period + o.acceptedRound !== currentRound) continue
        if (
            !Number.isFinite(o.amount) ||
            !Number.isFinite(o.delivered) ||
            !Number.isFinite(o.unitPenalty)
        )
            continue

        const thisRoundDelivery = deliveryByOrder.get(o.orderId) ?? 0
        const undelivered = Math.max(
            0,
            o.amount - o.delivered - thisRoundDelivery
        )
        let orderPenalty = 0
        let goodwillChange = 0
        if (undelivered === 0) {
            goodwillChange = 1
        } else {
            orderPenalty = undelivered * o.unitPenalty
            goodwillChange = -orderPenalty / 100
        }
        roundPenaltyAmount += orderPenalty
        goodwillDelta += goodwillChange
        perOrder.push({
            orderId: o.orderId,
            undelivered,
            orderPenalty,
            goodwillChange,
        })
    }

    return {roundPenaltyAmount, goodwillDelta, perOrder}
}

// ----------------------------------------------------------------------
// Financial impact rollup
// ----------------------------------------------------------------------

export interface FinancialImpactRow {
    key: string
    value: number
}

export interface FinancialRollupResult {
    /** Per-key signed value used in this round. Overridden keys carry
     *  the override; pass-through keys carry the cell value. */
    breakdownByKey: Record<string, number>
    /** Sum of all breakdown values EXCEPT keys in `excludeFromTotal`. */
    total: number
}

/**
 * Combine FinancialImpact cell readings + JS-side overrides into a
 * per-key breakdown and a single "apply to 资金" total. Overrides
 * shadow the cell value (used for 订单罚款 and 商誉变化 which the
 * engine settles in JS, not via formula). `excludeFromTotal` keeps
 * goodwill out of the cash sum.
 */
export function computeFinancialRollup(
    rows: ReadonlyArray<FinancialImpactRow>,
    overrides: Readonly<Record<string, number>>,
    excludeFromTotal: ReadonlySet<string>
): FinancialRollupResult {
    const breakdownByKey: Record<string, number> = {}
    let total = 0
    for (const row of rows) {
        const v = Object.prototype.hasOwnProperty.call(overrides, row.key)
            ? overrides[row.key]
            : row.value
        const safe = Number.isFinite(v) ? v : 0
        breakdownByKey[row.key] = safe
        if (!excludeFromTotal.has(row.key)) total += safe
    }
    return {breakdownByKey, total}
}

// ----------------------------------------------------------------------
// Supplier accumulator deltas
// ----------------------------------------------------------------------

export interface LineContribution {
    /** 本期产能 — units produced by this line this round. */
    capacity: number
    /** Supplier name → % allocation (0..1). */
    supplierPcts: Readonly<Record<string, number>>
}

/**
 * Per-supplier supply this round = sum over lines of capacity ×
 * supplier %. Non-finite / zero entries are filtered (matches the
 * runtime guard around `numericCellValue`). Suppliers with zero total
 * are omitted entirely so the caller can skip emitting no-op writes.
 */
export function computeSupplierAccumulatorDeltas(
    lines: ReadonlyArray<LineContribution>
): Map<string, number> {
    const totals = new Map<string, number>()
    for (const line of lines) {
        if (!Number.isFinite(line.capacity)) continue
        for (const [supplier, pct] of Object.entries(line.supplierPcts)) {
            if (!Number.isFinite(pct) || pct === 0) continue
            const add = line.capacity * pct
            if (add === 0) continue
            totals.set(supplier, (totals.get(supplier) ?? 0) + add)
        }
    }
    // Drop zeros after summing (e.g. when +x and −x cancel exactly).
    for (const [k, v] of totals) {
        if (v === 0) totals.delete(k)
    }
    return totals
}

// ----------------------------------------------------------------------
// Goodwill clamp
// ----------------------------------------------------------------------

/**
 * Apply `delta` to `base` and clamp to [min, max]. Pure, exposed so
 * the engine and the tests share one definition.
 */
export function clampGoodwill(
    base: number,
    delta: number,
    min: number,
    max: number
): number {
    const safeBase = Number.isFinite(base) ? base : min
    const safeDelta = Number.isFinite(delta) ? delta : 0
    return Math.max(min, Math.min(max, safeBase + safeDelta))
}

// ----------------------------------------------------------------------
// Endgame evaluation
// ----------------------------------------------------------------------

export type GameState =
    | 'playing'
    | 'won_ultimate'
    | 'won_gold'
    | 'won_silver'
    | 'won_bronze'
    | 'won_alive'
    | 'lost_bankruptcy'
    | 'lost_reputation'

export interface EndgameParams {
    maxRounds: number
    bankruptcyGraceRounds: number
    reputationGraceRounds: number
    /**
     * Reputation ceiling that triggers the "final achievement" tier.
     * Checked AHEAD of gold/silver/bronze and BEFORE the maxRounds gate
     * — reaching this goodwill ends the campaign immediately as a top
     * win regardless of remaining rounds or fund.
     */
    tierUltimateGoodwill: number
    tierGoldFund: number
    tierGoldGoodwill: number
    tierSilverFund: number
    tierSilverGoodwill: number
}

export interface EndgameInput {
    /** The round that just closed. */
    round: number
    /** 资金 AFTER this round's net cash applied. */
    fund: number
    /** 商誉 AFTER this round's delta applied + clamped. */
    goodwill: number
    /** Counter from start-of-round (will be incremented if fund < 0). */
    consecutiveLossRoundsBefore: number
    /** Counter from start-of-round (incremented if goodwill === 0). */
    consecutiveNoGoodwillRoundsBefore: number
}

export interface EndgameOutput {
    consecutiveLossRoundsAfter: number
    consecutiveNoGoodwillRoundsAfter: number
    gameState: GameState
}

/**
 * Evaluate the campaign state at the end of a tick. Updates the
 * consecutive counters, checks lose conditions, and — when the round
 * just closed is the campaign's last — assigns a win tier. Pure;
 * caller persists the counters + game state to the Constants block.
 *
 * Priority of terminal-state checks:
 *   1. Bankruptcy (fund streak)
 *   2. Reputation collapse (goodwill streak)
 *   3. MAX_ROUNDS win tier
 *
 * Lose takes priority over win — running out of money on round 20
 * is still a loss even though it's the campaign's last tick.
 */
export function evaluateEndgame(
    input: EndgameInput,
    params: EndgameParams
): EndgameOutput {
    const consecutiveLossRoundsAfter =
        input.fund < 0 ? input.consecutiveLossRoundsBefore + 1 : 0
    const consecutiveNoGoodwillRoundsAfter =
        input.goodwill <= 0 ? input.consecutiveNoGoodwillRoundsBefore + 1 : 0

    let gameState: GameState = 'playing'
    if (consecutiveLossRoundsAfter >= params.bankruptcyGraceRounds) {
        gameState = 'lost_bankruptcy'
    } else if (
        consecutiveNoGoodwillRoundsAfter >= params.reputationGraceRounds
    ) {
        gameState = 'lost_reputation'
    } else if (input.goodwill >= params.tierUltimateGoodwill) {
        // Ultimate achievement — reputation ceiling reached. Ends the
        // campaign early, no fund gate. Checked BEFORE the maxRounds
        // branch so the player gets the credit on the round they hit
        // the threshold rather than having to limp through the rest.
        gameState = 'won_ultimate'
    } else if (input.round >= params.maxRounds) {
        // Survived the campaign — assign tier.
        if (
            input.fund >= params.tierGoldFund &&
            input.goodwill >= params.tierGoldGoodwill
        ) {
            gameState = 'won_gold'
        } else if (
            input.fund >= params.tierSilverFund &&
            input.goodwill >= params.tierSilverGoodwill
        ) {
            gameState = 'won_silver'
        } else if (input.fund > 0 && input.goodwill > 0) {
            // Alive but below the named tiers: a "bronze" finish.
            gameState = 'won_bronze'
        } else {
            // Negative/zero on the dot — survived only barely.
            gameState = 'won_alive'
        }
    }

    return {
        consecutiveLossRoundsAfter,
        consecutiveNoGoodwillRoundsAfter,
        gameState,
    }
}
