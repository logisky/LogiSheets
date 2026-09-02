import {describe, expect, it} from 'vitest'
import {mapChartToOption} from './to-option'
import {formatAxisNumber} from './num-format'
import type {ChartModel} from './types'

function model(over: Partial<ChartModel> = {}): ChartModel {
    return {
        chartId: 'c1',
        chartType: 'col',
        categories: ['Q1', 'Q2'],
        series: [
            {
                name: 'Sales',
                values: [1234.5, 6789],
                formattedValues: ['1,234.50', '6,789.00'],
            },
        ],
        ...over,
    }
}

/** The label formatter ECharts would call for point `i` of series 0. */
function labelText(
    option: ReturnType<typeof mapChartToOption>,
    i: number,
    percent?: number
): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (option.series as any[])[0]
    return s.label.formatter({dataIndex: i, percent})
}

describe('mapChartToOption — data labels', () => {
    it('shows nothing when the chart has no labels', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (mapChartToOption(model()).series as any[])[0]
        expect(s.label.show).toBe(false)
    })

    it('renders the value with the format the core resolved', () => {
        const option = mapChartToOption(
            model({
                dataLabels: {
                    value: true,
                    category: false,
                    series: false,
                    percent: false,
                },
            })
        )
        expect(labelText(option, 0)).toBe('1,234.50')
        expect(labelText(option, 1)).toBe('6,789.00')
    })

    it('joins the parts Excel-style when several are enabled', () => {
        const option = mapChartToOption(
            model({
                dataLabels: {
                    value: true,
                    category: true,
                    series: true,
                    percent: false,
                },
            })
        )
        expect(labelText(option, 0)).toBe('Sales, Q1, 1,234.50')
    })

    it('falls back to the raw number when no formatted string was sent', () => {
        const option = mapChartToOption(
            model({
                series: [{name: 'S', values: [42]}],
                dataLabels: {
                    value: true,
                    category: false,
                    series: false,
                    percent: false,
                },
            })
        )
        expect(labelText(option, 0)).toBe('42')
    })

    it('adds the percentage on a pie, which only ECharts can compute', () => {
        const option = mapChartToOption(
            model({
                chartType: 'pie',
                dataLabels: {
                    value: false,
                    category: true,
                    series: false,
                    percent: true,
                },
            })
        )
        expect(labelText(option, 0, 15.4)).toBe('Q1, 15.4%')
    })
})

describe('mapChartToOption — axes', () => {
    it('formats value-axis ticks with the chart number format', () => {
        const option = mapChartToOption(model({valAxisNumFmt: '#,##0.0'}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fmt = (option.yAxis as any).axisLabel.formatter
        expect(fmt(1234.5)).toBe('1,234.5')
    })

    it('leaves ticks alone when the chart has no number format', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((mapChartToOption(model()).yAxis as any).axisLabel).toBeUndefined()
    })

    it('puts the value axis on X for a bar chart', () => {
        const option = mapChartToOption(
            model({chartType: 'bar', valAxisNumFmt: '0%'})
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((option.xAxis as any).axisLabel.formatter(0.25)).toBe('25%')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((option.yAxis as any).type).toBe('category')
    })
})

describe('mapChartToOption — axis scale', () => {
    it('pins the bounds and tick spacing the chart sets', () => {
        const option = mapChartToOption(
            model({
                valAxisScale: {
                    min: 0,
                    max: 80,
                    majorUnit: 20,
                    reversed: false,
                },
            })
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const y = option.yAxis as any
        expect(y.min).toBe(0)
        expect(y.max).toBe(80)
        expect(y.interval).toBe(20)
        expect(y.type).toBe('value')
    })

    it('leaves an automatic axis to the renderer', () => {
        const option = mapChartToOption(model({valAxisScale: {reversed: false}}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const y = option.yAxis as any
        expect(y.min).toBeUndefined()
        expect(y.max).toBeUndefined()
        expect(y.interval).toBeUndefined()
        expect(y.inverse).toBeUndefined()
    })

    it('switches the axis type for a log scale', () => {
        const option = mapChartToOption(
            model({valAxisScale: {logBase: 10, reversed: true}})
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const y = option.yAxis as any
        expect(y.type).toBe('log')
        expect(y.logBase).toBe(10)
        expect(y.inverse).toBe(true)
    })

    it('applies the scale to X when the bars are horizontal', () => {
        const option = mapChartToOption(
            model({chartType: 'bar', valAxisScale: {max: 50, reversed: false}})
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((option.xAxis as any).max).toBe(50)
    })

    it('only takes the direction from a category axis', () => {
        const option = mapChartToOption(
            model({catAxisScale: {reversed: true, min: 3}})
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const x = option.xAxis as any
        expect(x.inverse).toBe(true)
        expect(x.min).toBeUndefined()
    })
})

describe('mapChartToOption — radar', () => {
    it('turns categories into spokes with one shared maximum', () => {
        const option = mapChartToOption(
            model({
                chartType: 'radar',
                categories: ['Speed', 'Power', 'Range'],
                series: [
                    {name: 'A', values: [3, 9, 6]},
                    {name: 'B', values: [7, 2, 4]},
                ],
            })
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const radar = (option as any).radar
        expect(radar.indicator.map((i: {name: string}) => i.name)).toEqual([
            'Speed',
            'Power',
            'Range',
        ])
        // A single max across every series, so the shapes stay comparable.
        expect(radar.indicator.every((i: {max: number}) => i.max === 9)).toBe(true)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (option.series as any[])[0]
        expect(s.type).toBe('radar')
        expect(s.data).toHaveLength(2)
        expect(s.data[1].value).toEqual([7, 2, 4])
        expect(option.grid).toBeUndefined()
    })

    it('treats gaps as zero so the polygon still closes', () => {
        const option = mapChartToOption(
            model({
                chartType: 'radar',
                categories: ['a', 'b'],
                series: [{name: 'A', values: [5, null]}],
            })
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((option.series as any[])[0].data[0].value).toEqual([5, 0])
    })
})

describe('mapChartToOption — bubble', () => {
    const bubble = () =>
        mapChartToOption(
            model({
                chartType: 'bubble',
                categories: [1, 2, 3],
                series: [
                    {
                        name: 'P',
                        values: [10, 20, 30],
                        sizes: [25, 100, null],
                    },
                ],
            })
        )

    it('packs [x, y, size] triples', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (bubble().series as any[])[0]
        expect(s.type).toBe('scatter')
        expect(s.data[0]).toEqual([1, 10, 25])
        expect(s.data[2]).toEqual([3, 30, null])
    })

    it('sizes by area, normalized to the largest bubble', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (bubble().series as any[])[0]
        // 100 is the largest → full radius; 25 is a quarter of the area, so
        // half the radius.
        expect(s.symbolSize([1, 10, 100])).toBeCloseTo(40)
        expect(s.symbolSize([1, 10, 25])).toBeCloseTo(20)
    })

    it('falls back to a default radius when a size is missing', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (bubble().series as any[])[0]
        expect(s.symbolSize([3, 30, null])).toBe(10)
        // A series with no sizes at all still plots.
        const none = mapChartToOption(
            model({chartType: 'bubble', series: [{name: 'P', values: [1, 2]}]})
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((none.series as any[])[0].symbolSize([0, 1, null])).toBe(10)
    })

    it('keeps two value axes, like scatter', () => {
        const option = bubble()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((option.xAxis as any).type).toBe('value')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((option.yAxis as any).type).toBe('value')
    })
})

describe('mapChartToOption — stock', () => {
    const ohlc = (names: string[]) =>
        model({
            chartType: 'stock',
            categories: ['Mon', 'Tue'],
            series: names.map((n, i) => ({
                name: n,
                values: [10 + i, 20 + i],
            })),
        })

    it('reads four series as open/high/low/close', () => {
        const option = ohlc(['Open', 'High', 'Low', 'Close'])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (mapChartToOption(option).series as any[])[0]
        expect(s.type).toBe('candlestick')
        // ECharts order is [open, close, low, high].
        expect(s.data[0]).toEqual([10, 13, 12, 11])
    })

    it('reads three series as high/low/close, with open = close', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (mapChartToOption(ohlc(['High', 'Low', 'Close'])).series as any[])[0]
        // High=10, Low=11, Close=12 → [open=12, close=12, low=11, high=10]
        expect(s.data[0]).toEqual([12, 12, 11, 10])
    })

    it('falls back to lines when the series count is not a stock shape', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (mapChartToOption(ohlc(['A', 'B'])).series as any[])[0]
        expect(s.type).toBe('bar')
    })

    it('lets the price axis frame the data instead of starting at zero', () => {
        const option = mapChartToOption(ohlc(['O', 'H', 'L', 'C']))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((option.yAxis as any).scale).toBe(true)
    })
})

describe('mapChartToOption — of pie', () => {
    const ofPie = (over = {}) =>
        model({
            chartType: 'ofPie',
            categories: ['a', 'b', 'c', 'd', 'e'],
            series: [{name: 'S', values: [50, 30, 10, 6, 4]}],
            ...over,
        })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plots = (m: ChartModel) => mapChartToOption(m).series as any[]

    it('splits the last N points by position', () => {
        const [main, second] = plots(ofPie({ofPieSplit: {by: 'pos', pos: 2}}))
        expect(main.data.map((d: {name: string}) => d.name)).toEqual([
            'a',
            'b',
            'c',
            'Other',
        ])
        // "Other" is the sum of what moved to the second plot.
        expect(main.data[3].value).toBe(10)
        expect(second.data.map((d: {name: string}) => d.name)).toEqual(['d', 'e'])
    })

    it('splits by value threshold', () => {
        const [main, second] = plots(ofPie({ofPieSplit: {by: 'val', pos: 10}}))
        expect(second.data.map((d: {name: string}) => d.name)).toEqual(['d', 'e'])
        expect(main.data[3].value).toBe(10)
    })

    it('splits by percentage of the total', () => {
        // Total is 100, so a 7% threshold moves the 6 and the 4.
        const [, second] = plots(ofPie({ofPieSplit: {by: 'percent', pos: 7}}))
        expect(second.data.map((d: {name: string}) => d.name)).toEqual(['d', 'e'])
    })

    it('defaults to the last two points when no split is authored', () => {
        const [, second] = plots(ofPie())
        expect(second.data.map((d: {name: string}) => d.name)).toEqual(['d', 'e'])
    })

    it('draws the second plot as a stacked column for barOfPie', () => {
        const series = plots(
            ofPie({chartType: 'barOfPie', ofPieSplit: {by: 'pos', pos: 2}})
        )
        expect(series[0].type).toBe('pie')
        expect(series.slice(1).every((s) => s.type === 'bar')).toBe(true)
        expect(series.slice(1).every((s) => s.stack === 'other')).toBe(true)
        // The column needs a grid; the pie half sits beside it.
        expect(mapChartToOption(
            ofPie({chartType: 'barOfPie', ofPieSplit: {by: 'pos', pos: 2}})
        ).grid).toBeDefined()
    })
})

describe('mapChartToOption — surface', () => {
    const surface = (type: 'surface' | 'surface3d' = 'surface') =>
        mapChartToOption(
            model({
                chartType: type,
                categories: ['x1', 'x2'],
                series: [
                    {name: 'r1', values: [1, 4]},
                    {name: 'r2', values: [9, null]},
                ],
            })
        )

    it('lays the grid out as [col, row, value] heatmap cells', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (surface().series as any[])[0]
        expect(s.type).toBe('heatmap')
        // The null is a hole in the grid, not a zero.
        expect(s.data).toEqual([
            [0, 0, 1],
            [1, 0, 4],
            [0, 1, 9],
        ])
    })

    it('scales the colour map to the data', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vm = (surface() as any).visualMap
        expect(vm.min).toBe(1)
        expect(vm.max).toBe(9)
    })

    it('labels the axes with the categories and the series names', () => {
        const option = surface()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((option.xAxis as any).data).toEqual(['x1', 'x2'])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((option.yAxis as any).data).toEqual(['r1', 'r2'])
    })

    it('draws the 3-D form the same flat way', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((surface('surface3d').series as any[])[0].type).toBe('heatmap')
    })

    it('survives an all-empty grid', () => {
        const option = mapChartToOption(
            model({chartType: 'surface', series: [{name: 'r', values: [null]}]})
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vm = (option as any).visualMap
        expect(Number.isFinite(vm.min) && Number.isFinite(vm.max)).toBe(true)
    })
})

describe('mapChartToOption — 3-D kinds', () => {
    it('draws each 3-D kind as its flat equivalent', () => {
        const cases: Array<[string, string]> = [
            ['col3d', 'bar'],
            ['bar3d', 'bar'],
            ['line3d', 'line'],
            ['area3d', 'line'],
        ]
        for (const [type, expected] of cases) {
            const option = mapChartToOption(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                model({chartType: type as any})
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((option.series as any[])[0].type).toBe(expected)
        }
    })

    it('keeps the flat kind’s orientation and fill', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bar3d = mapChartToOption(model({chartType: 'bar3d' as any}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((bar3d.yAxis as any).type).toBe('category')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const area3d = mapChartToOption(model({chartType: 'area3d' as any}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((area3d.series as any[])[0].areaStyle).toBeDefined()
    })

    it('draws a 3-D pie as a pie, with no grid', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const option = mapChartToOption(model({chartType: 'pie3d' as any}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((option.series as any[])[0].type).toBe('pie')
        expect(option.grid).toBeUndefined()
    })
})

describe('mapChartToOption — combo', () => {
    const combo = (over = {}) =>
        mapChartToOption(
            model({
                chartType: 'col',
                series: [
                    {name: 'Revenue', values: [1, 2]},
                    {name: 'Margin', values: [3, 4], seriesType: 'line'},
                    {name: 'Churn', values: [5, 6], seriesType: 'area'},
                ],
                ...over,
            })
        )

    it('gives each series the kind it asks for', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const series = combo().series as any[]
        expect(series.map((s) => s.type)).toEqual(['bar', 'line', 'line'])
        // Area is a line with a fill.
        expect(series[1].areaStyle).toBeUndefined()
        expect(series[2].areaStyle).toBeDefined()
    })

    it('stacks only the series that follow the chart’s own kind', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const series = combo({stacked: true}).series as any[]
        expect(series[0].stack).toBe('total')
        expect(series[1].stack).toBeUndefined()
        expect(series[2].stack).toBeUndefined()
    })

    it('leaves a chart with no overrides unchanged', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const series = mapChartToOption(model({stacked: true})).series as any[]
        expect(series.every((s) => s.type === 'bar')).toBe(true)
        expect(series.every((s) => s.stack === 'total')).toBe(true)
    })

    it('flattens a 3-D override to its drawable kind', () => {
        const option = mapChartToOption(
            model({
                chartType: 'col',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                series: [{name: 'a', values: [1], seriesType: 'line3d' as any}],
            })
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((option.series as any[])[0].type).toBe('line')
    })
})

describe('formatAxisNumber', () => {
    it('applies separators and fixed decimals', () => {
        expect(formatAxisNumber('#,##0.00', 1234.5)).toBe('1,234.50')
        expect(formatAxisNumber('0.0', 1234.56)).toBe('1234.6')
    })

    it('scales percentages', () => {
        expect(formatAxisNumber('0%', 0.256)).toBe('26%')
        expect(formatAxisNumber('0.0%', 0.256)).toBe('25.6%')
    })

    it('keeps a currency prefix', () => {
        expect(formatAxisNumber('$#,##0', 1500)).toBe('$1,500')
    })

    it('uses the positive section of a multi-section code', () => {
        expect(formatAxisNumber('#,##0.00;[Red]-#,##0.00', 12.3)).toBe('12.30')
    })

    it('passes the number through for General, dates and no format', () => {
        expect(formatAxisNumber(undefined, 12.5)).toBe('12.5')
        expect(formatAxisNumber('General', 12.5)).toBe('12.5')
        expect(formatAxisNumber('yyyy-mm-dd', 45000)).toBe('45000')
    })
})
