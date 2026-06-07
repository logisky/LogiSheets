import {describe, it, expect} from 'vitest'
import {
    computeRoundPenaltyAndGoodwill,
    computeFinancialRollup,
    computeSupplierAccumulatorDeltas,
    clampGoodwill,
    evaluateEndgame,
    type AcceptedOrderRow,
    type OrderContributionRow,
    type FinancialImpactRow,
    type LineContribution,
    type EndgameParams,
} from './round'

// Convenience: build an AcceptedOrderRow with sensible defaults so each
// test names only the fields it actually cares about.
const order = (
    overrides: Partial<AcceptedOrderRow> = {}
): AcceptedOrderRow => ({
    orderId: 'A',
    amount: 10,
    period: 3,
    acceptedRound: 1,
    delivered: 0,
    unitPenalty: 100,
    ...overrides,
})

const contrib = (
    overrides: Partial<OrderContributionRow> = {}
): OrderContributionRow => ({
    orderId: 'A',
    currentDelivery: 0,
    ...overrides,
})

describe('computeRoundPenaltyAndGoodwill', () => {
    it('returns zero everything when no orders are at deadline', () => {
        const result = computeRoundPenaltyAndGoodwill(
            [order({period: 3, acceptedRound: 1})], // deadline at round 4
            [],
            2 // not the deadline
        )
        expect(result.roundPenaltyAmount).toBe(0)
        expect(result.goodwillDelta).toBe(0)
        expect(result.perOrder).toEqual([])
    })

    it('rewards goodwill on a fully-delivered order at deadline', () => {
        const result = computeRoundPenaltyAndGoodwill(
            [order({amount: 10, delivered: 8})],
            [contrib({currentDelivery: 2})], // 8 + 2 == 10, fully delivered
            4
        )
        expect(result.roundPenaltyAmount).toBe(0)
        expect(result.goodwillDelta).toBe(1)
        expect(result.perOrder).toEqual([
            {
                orderId: 'A',
                undelivered: 0,
                orderPenalty: 0,
                goodwillChange: 1,
            },
        ])
    })

    it('charges penalty + drops goodwill on under-delivery at deadline', () => {
        const result = computeRoundPenaltyAndGoodwill(
            [order({amount: 10, delivered: 4, unitPenalty: 200})],
            [contrib({currentDelivery: 2})], // 4 undelivered
            4
        )
        // 4 undelivered × 200 = 800 penalty
        expect(result.roundPenaltyAmount).toBe(800)
        // goodwill drops by penalty/100
        expect(result.goodwillDelta).toBe(-8)
        expect(result.perOrder).toEqual([
            {
                orderId: 'A',
                undelivered: 4,
                orderPenalty: 800,
                goodwillChange: -8,
            },
        ])
    })

    it('ignores over-delivery (clamps undelivered at zero)', () => {
        const result = computeRoundPenaltyAndGoodwill(
            [order({amount: 10, delivered: 8})],
            [contrib({currentDelivery: 5})], // total 13 > 10
            4
        )
        expect(result.roundPenaltyAmount).toBe(0)
        expect(result.goodwillDelta).toBe(1)
    })

    it('aggregates across multiple expiring orders', () => {
        const result = computeRoundPenaltyAndGoodwill(
            [
                order({
                    orderId: 'A',
                    amount: 10,
                    delivered: 10, // fully delivered already, no penalty
                    period: 3,
                    acceptedRound: 1,
                }),
                order({
                    orderId: 'B',
                    amount: 5,
                    delivered: 0,
                    unitPenalty: 100,
                    period: 3,
                    acceptedRound: 1,
                }), // 5 × 100 = 500 penalty, −5 goodwill
                order({
                    orderId: 'C',
                    amount: 8,
                    delivered: 2,
                    unitPenalty: 50,
                    period: 3,
                    acceptedRound: 1,
                }), // 6 × 50 = 300 penalty, −3 goodwill
            ],
            [contrib({orderId: 'A', currentDelivery: 0})],
            4
        )
        expect(result.roundPenaltyAmount).toBe(800)
        expect(result.goodwillDelta).toBe(1 - 5 - 3)
        expect(result.perOrder).toHaveLength(3)
    })

    it('skips orders past their deadline (already expired)', () => {
        const result = computeRoundPenaltyAndGoodwill(
            [order({period: 3, acceptedRound: 1})], // deadline at round 4
            [],
            5 // already past
        )
        expect(result.roundPenaltyAmount).toBe(0)
        expect(result.goodwillDelta).toBe(0)
    })

    it('skips rows with non-finite numbers (defensive against blank cells)', () => {
        const result = computeRoundPenaltyAndGoodwill(
            [
                order({orderId: '', amount: NaN}),
                order({orderId: 'B', period: NaN}),
                order({orderId: 'C', acceptedRound: NaN}),
                order({orderId: 'D', delivered: NaN, period: 3, acceptedRound: 1}),
                order({orderId: 'E', unitPenalty: NaN, period: 3, acceptedRound: 1}),
            ],
            [],
            4
        )
        expect(result.roundPenaltyAmount).toBe(0)
        expect(result.goodwillDelta).toBe(0)
        expect(result.perOrder).toEqual([])
    })

    it('treats missing OrderContribution row as currentDelivery = 0', () => {
        const result = computeRoundPenaltyAndGoodwill(
            [order({amount: 10, delivered: 4, unitPenalty: 50})],
            [], // no contribution row → 6 undelivered, 300 penalty
            4
        )
        expect(result.roundPenaltyAmount).toBe(300)
        expect(result.goodwillDelta).toBe(-3)
    })
})

describe('computeFinancialRollup', () => {
    const rows = (
        ...entries: Array<[string, number]>
    ): FinancialImpactRow[] => entries.map(([key, value]) => ({key, value}))

    it('sums all rows when no overrides / no exclusions', () => {
        const result = computeFinancialRollup(
            rows(['a', 10], ['b', -3], ['c', 7]),
            {},
            new Set()
        )
        expect(result.total).toBe(14)
        expect(result.breakdownByKey).toEqual({a: 10, b: -3, c: 7})
    })

    it('overrides shadow cell values', () => {
        const result = computeFinancialRollup(
            rows(['a', 10], ['b', -3]),
            {b: 99}, // override
            new Set()
        )
        expect(result.breakdownByKey).toEqual({a: 10, b: 99})
        expect(result.total).toBe(109)
    })

    it('excluded keys appear in breakdown but not in total', () => {
        const result = computeFinancialRollup(
            rows(['a', 10], ['goodwill', 5], ['b', 3]),
            {},
            new Set(['goodwill'])
        )
        expect(result.breakdownByKey).toEqual({a: 10, goodwill: 5, b: 3})
        expect(result.total).toBe(13)
    })

    it('coerces NaN row values to 0', () => {
        const result = computeFinancialRollup(
            rows(['a', NaN], ['b', 5]),
            {},
            new Set()
        )
        expect(result.breakdownByKey).toEqual({a: 0, b: 5})
        expect(result.total).toBe(5)
    })

    it('override with explicit 0 still wins over cell value', () => {
        const result = computeFinancialRollup(
            rows(['penalty', -300]),
            {penalty: 0},
            new Set()
        )
        expect(result.breakdownByKey).toEqual({penalty: 0})
        expect(result.total).toBe(0)
    })
})

describe('computeSupplierAccumulatorDeltas', () => {
    const line = (
        capacity: number,
        supplierPcts: Record<string, number>
    ): LineContribution => ({capacity, supplierPcts})

    it('sums per-supplier contributions across lines', () => {
        const result = computeSupplierAccumulatorDeltas([
            line(10, {A: 0.5, B: 0.5}),
            line(20, {A: 0.25, B: 0.75}),
        ])
        // A: 10×0.5 + 20×0.25 = 10
        // B: 10×0.5 + 20×0.75 = 20
        expect(result.get('A')).toBe(10)
        expect(result.get('B')).toBe(20)
    })

    it('omits suppliers with zero allocation entirely', () => {
        const result = computeSupplierAccumulatorDeltas([
            line(10, {A: 1, B: 0}),
        ])
        expect(result.has('A')).toBe(true)
        expect(result.has('B')).toBe(false)
    })

    it('skips lines with non-finite capacity', () => {
        const result = computeSupplierAccumulatorDeltas([
            line(NaN, {A: 1}),
            line(5, {A: 1}),
        ])
        expect(result.get('A')).toBe(5)
    })

    it('skips non-finite supplier pcts within a line', () => {
        const result = computeSupplierAccumulatorDeltas([
            line(10, {A: NaN, B: 0.5}),
        ])
        expect(result.has('A')).toBe(false)
        expect(result.get('B')).toBe(5)
    })

    it('returns empty map for empty input', () => {
        expect(computeSupplierAccumulatorDeltas([]).size).toBe(0)
    })
})

describe('evaluateEndgame', () => {
    const params: EndgameParams = {
        maxRounds: 20,
        bankruptcyGraceRounds: 3,
        reputationGraceRounds: 2,
        tierGoldFund: 80000,
        tierGoldGoodwill: 100,
        tierSilverFund: 30000,
        tierSilverGoodwill: 80,
    }

    it('stays in playing during normal rounds', () => {
        const r = evaluateEndgame(
            {
                round: 5,
                fund: 1000,
                goodwill: 100,
                consecutiveLossRoundsBefore: 0,
                consecutiveNoGoodwillRoundsBefore: 0,
            },
            params
        )
        expect(r.gameState).toBe('playing')
        expect(r.consecutiveLossRoundsAfter).toBe(0)
        expect(r.consecutiveNoGoodwillRoundsAfter).toBe(0)
    })

    it('increments loss streak when fund negative, resets when positive', () => {
        const r1 = evaluateEndgame(
            {
                round: 5,
                fund: -100,
                goodwill: 100,
                consecutiveLossRoundsBefore: 1,
                consecutiveNoGoodwillRoundsBefore: 0,
            },
            params
        )
        expect(r1.consecutiveLossRoundsAfter).toBe(2)
        expect(r1.gameState).toBe('playing')

        const r2 = evaluateEndgame(
            {
                round: 6,
                fund: 500,
                goodwill: 100,
                consecutiveLossRoundsBefore: 2,
                consecutiveNoGoodwillRoundsBefore: 0,
            },
            params
        )
        // Fund back in the black — streak resets.
        expect(r2.consecutiveLossRoundsAfter).toBe(0)
        expect(r2.gameState).toBe('playing')
    })

    it('loses on bankruptcy streak hitting the grace limit', () => {
        const r = evaluateEndgame(
            {
                round: 4,
                fund: -50,
                goodwill: 80,
                consecutiveLossRoundsBefore: 2,
                consecutiveNoGoodwillRoundsBefore: 0,
            },
            params
        )
        expect(r.consecutiveLossRoundsAfter).toBe(3)
        expect(r.gameState).toBe('lost_bankruptcy')
    })

    it('loses on reputation streak hitting the grace limit', () => {
        const r = evaluateEndgame(
            {
                round: 4,
                fund: 1000,
                goodwill: 0,
                consecutiveLossRoundsBefore: 0,
                consecutiveNoGoodwillRoundsBefore: 1,
            },
            params
        )
        expect(r.consecutiveNoGoodwillRoundsAfter).toBe(2)
        expect(r.gameState).toBe('lost_reputation')
    })

    it('bankruptcy takes priority over win-tier at MAX_ROUNDS', () => {
        const r = evaluateEndgame(
            {
                round: 20,
                fund: -1000,
                goodwill: 100,
                consecutiveLossRoundsBefore: 2,
                consecutiveNoGoodwillRoundsBefore: 0,
            },
            params
        )
        expect(r.gameState).toBe('lost_bankruptcy')
    })

    it('assigns gold tier at MAX_ROUNDS when both thresholds met', () => {
        const r = evaluateEndgame(
            {
                round: 20,
                fund: 90000,
                goodwill: 120,
                consecutiveLossRoundsBefore: 0,
                consecutiveNoGoodwillRoundsBefore: 0,
            },
            params
        )
        expect(r.gameState).toBe('won_gold')
    })

    it('falls to silver when gold conditions miss but silver passes', () => {
        const r = evaluateEndgame(
            {
                round: 20,
                fund: 50000,
                goodwill: 90,
                consecutiveLossRoundsBefore: 0,
                consecutiveNoGoodwillRoundsBefore: 0,
            },
            params
        )
        expect(r.gameState).toBe('won_silver')
    })

    it('gold-fund + low-goodwill still falls through to silver/bronze', () => {
        const r = evaluateEndgame(
            {
                round: 20,
                fund: 100000,
                goodwill: 90, // not gold (need ≥100), is silver-eligible
                consecutiveLossRoundsBefore: 0,
                consecutiveNoGoodwillRoundsBefore: 0,
            },
            params
        )
        expect(r.gameState).toBe('won_silver')
    })

    it('bronze when alive but below silver thresholds', () => {
        const r = evaluateEndgame(
            {
                round: 20,
                fund: 5000,
                goodwill: 50,
                consecutiveLossRoundsBefore: 0,
                consecutiveNoGoodwillRoundsBefore: 0,
            },
            params
        )
        expect(r.gameState).toBe('won_bronze')
    })

    it('won_alive when on the wire (fund=0 or goodwill=0)', () => {
        const r = evaluateEndgame(
            {
                round: 20,
                fund: 0,
                goodwill: 50,
                consecutiveLossRoundsBefore: 0,
                consecutiveNoGoodwillRoundsBefore: 0,
            },
            params
        )
        expect(r.gameState).toBe('won_alive')
    })

    it('does not assign win before MAX_ROUNDS', () => {
        const r = evaluateEndgame(
            {
                round: 19,
                fund: 90000,
                goodwill: 120,
                consecutiveLossRoundsBefore: 0,
                consecutiveNoGoodwillRoundsBefore: 0,
            },
            params
        )
        expect(r.gameState).toBe('playing')
    })
})

describe('clampGoodwill', () => {
    it('clamps to max', () => {
        expect(clampGoodwill(149, 5, 0, 150)).toBe(150)
    })
    it('clamps to min', () => {
        expect(clampGoodwill(5, -20, 0, 150)).toBe(0)
    })
    it('passes through inside the range', () => {
        expect(clampGoodwill(100, 5, 0, 150)).toBe(105)
        expect(clampGoodwill(100, -5, 0, 150)).toBe(95)
    })
    it('coerces non-finite base to min', () => {
        expect(clampGoodwill(NaN, 5, 0, 150)).toBe(5)
    })
    it('coerces non-finite delta to 0', () => {
        expect(clampGoodwill(50, NaN, 0, 150)).toBe(50)
    })
})
