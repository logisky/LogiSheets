import {describe, expect, it} from 'vitest'
import type {ChartExInfo} from 'logisheets-web'
import {chartExToOption, treeData, waterfallSegments} from './ex-option'

function info(patch: Partial<ChartExInfo>): ChartExInfo {
    return {
        kind: 'treemap',
        categories: [],
        values: [],
        formattedValues: [],
        subtotals: [],
        cumulativePercent: [],
        nodes: [],
        boxSeries: [],
        showMean: true,
        showOutliers: true,
        ...patch,
    } as ChartExInfo
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const series = (o: any) => o.series as any[]

describe('treeData', () => {
    it('rebuilds the hierarchy from parent indices', () => {
        const roots = treeData(
            info({
                nodes: [
                    {name: 'East', value: 65},
                    {name: 'Shanghai', value: 40, parent: 0},
                    {name: 'Hangzhou', value: 25, parent: 0},
                    {name: 'West', value: 5},
                ],
            })
        )
        expect(roots.map((r) => r.name)).toEqual(['East', 'West'])
        expect(roots[0].children?.map((c) => c.name)).toEqual([
            'Shanghai',
            'Hangzhou',
        ])
        expect(roots[1].children).toBeUndefined()
    })
})

describe('waterfallSegments', () => {
    it('floats each step on the running total and draws totals from zero', () => {
        const s = waterfallSegments([100, 40, -15, -30, 95], [4])
        expect(s[0]).toEqual({base: 0, up: 100, down: 0, kind: 'up'})
        expect(s[1]).toEqual({base: 100, up: 40, down: 0, kind: 'up'})
        // 140 → 125: floats from 125, 15 tall.
        expect(s[2]).toEqual({base: 125, up: 15, down: 0, kind: 'down'})
        expect(s[4]).toEqual({base: 0, up: 95, down: 0, kind: 'total'})
    })

    it('splits a step that crosses zero and stacks negatives downward', () => {
        const s = waterfallSegments([10, -30, -5], [])
        // 10 → -20 crosses zero: 10 above, -20 below.
        expect(s[1]).toEqual({base: 0, up: 10, down: -20, kind: 'down'})
        // -20 → -25 is wholly negative: floats down from -20.
        expect(s[2]).toEqual({base: -20, up: 0, down: -5, kind: 'down'})
    })
})

describe('chartExToOption', () => {
    it('draws each kind with its ECharts series', () => {
        const kinds: Array<[string, string[]]> = [
            ['treemap', ['treemap']],
            ['sunburst', ['sunburst']],
            ['funnel', ['funnel']],
            ['waterfall', ['bar', 'bar', 'bar']],
            ['histogram', ['bar']],
            ['pareto', ['bar', 'line']],
        ]
        for (const [kind, types] of kinds) {
            const o = chartExToOption(info({kind}))
            expect(series(o).map((s) => s.type), kind).toEqual(types)
        }
    })

    it('puts a Pareto line on a 0–100% second axis', () => {
        const o = chartExToOption(
            info({
                kind: 'pareto',
                categories: ['a', 'b'],
                values: [3, 1],
                cumulativePercent: [75, 100],
            })
        )
        expect(series(o)[1].yAxisIndex).toBe(1)
        expect(series(o)[1].data).toEqual([75, 100])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((o.yAxis as any[])[1]).toMatchObject({min: 0, max: 100})
    })

    it('lays boxes out per category, with mean and outlier points', () => {
        const o = chartExToOption(
            info({
                kind: 'boxWhisker',
                boxSeries: [
                    {
                        name: 'Score',
                        boxes: [
                            {category: 'East', min: 12, q1: 12, median: 15, q3: 18, max: 18, mean: 15, outliers: []},
                            {category: 'South', min: 30, q1: 30, median: 40, q3: 50, max: 50, mean: 50, outliers: [90]},
                        ],
                    },
                ],
            })
        )
        const s = series(o)
        expect(s.map((x) => x.type)).toEqual(['boxplot', 'scatter', 'scatter'])
        expect(s[0].data[0]).toEqual([12, 12, 15, 18, 18])
        expect(s[2].data).toEqual([[1, 90]])
    })

    it('keeps funnel stages in sheet order', () => {
        const o = chartExToOption(info({kind: 'funnel', categories: ['a'], values: [1]}))
        expect(series(o)[0].sort).toBe('none')
    })
})
