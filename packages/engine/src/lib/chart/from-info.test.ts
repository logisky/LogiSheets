import {describe, expect, it} from 'vitest'
import type {ChartInfo} from 'logisheets-web'
import {chartInfoToModel} from './from-info'

/**
 * A `ChartInfo` as the core sends it. Everything the adapter reads has to be
 * present here — a field the adapter forgets is invisible at the type level
 * (both sides are optional) and shows up only as a chart that quietly ignores
 * one of its settings.
 */
function info(over: Partial<ChartInfo> = {}): ChartInfo {
    return {
        chartId: 'chart1',
        fromRow: 0,
        fromCol: 0,
        fromColOff: 0,
        fromRowOff: 0,
        toRow: 10,
        toCol: 5,
        toColOff: 0,
        toRowOff: 0,
        chartType: 'col',
        stacked: false,
        categories: ['Q1', 'Q2'],
        series: [
            {
                name: 'Sales',
                values: [1, 2],
                formattedValues: ['1', '2'],
                sizes: [],
            },
        ],
        dataLabels: {
            showValue: false,
            showCategory: false,
            showSeries: false,
            showPercent: false,
            showLegendKey: false,
        },
        ofPieSplit: {},
        valAxisScale: {reversed: false},
        catAxisScale: {reversed: false},
        ...over,
    } as ChartInfo
}

describe('chartInfoToModel', () => {
    it('carries the render fields across', () => {
        const model = chartInfoToModel(
            info({
                chartType: 'line',
                title: 'T',
                stacked: true,
                legendPos: 'top',
                catAxisTitle: 'X',
                valAxisTitle: 'Y',
                valAxisNumFmt: '#,##0',
                catRef: 'Sheet1!$A$2:$A$3',
            })
        )
        expect(model).toMatchObject({
            chartId: 'chart1',
            chartType: 'line',
            title: 'T',
            stacked: true,
            legendPosition: 'top',
            catAxisTitle: 'X',
            valAxisTitle: 'Y',
            valAxisNumFmt: '#,##0',
            catRef: 'Sheet1!$A$2:$A$3',
            categories: ['Q1', 'Q2'],
        })
    })

    it('treats a chart with no legend as one that shows none', () => {
        expect(chartInfoToModel(info()).legendPosition).toBe('none')
    })

    it('synthesizes 1..n categories when the chart has none', () => {
        const model = chartInfoToModel(
            info({
                categories: [],
                series: [
                    {
                        name: 'S',
                        values: [5, 6, 7],
                        formattedValues: ['5', '6', '7'],
                        sizes: [],
                    },
                ],
            })
        )
        expect(model.categories).toEqual([1, 2, 3])
    })

    it('keeps the gaps in a series rather than zeroing them', () => {
        const model = chartInfoToModel(
            info({
                series: [
                    {
                        name: 'S',
                        // The binding types these as number[]/string[], but the
                        // core sends nulls for empty cells.
                        values: [1, null, 3],
                        formattedValues: ['1', null, '3'],
                        sizes: [],
                    } as unknown as ChartInfo['series'][number],
                ],
            })
        )
        expect(model.series[0].values).toEqual([1, null, 3])
        expect(model.series[0].formattedValues).toEqual(['1', null, '3'])
    })

    it('copies the arrays instead of aliasing the binding', () => {
        const source = info()
        const model = chartInfoToModel(source)
        expect(model.categories).not.toBe(source.categories)
        expect(model.series[0].values).not.toBe(source.series[0].values)
    })

    it('maps the data-label flags', () => {
        const model = chartInfoToModel(
            info({
                dataLabels: {
                    showValue: true,
                    showCategory: true,
                    showSeries: false,
                    showPercent: true,
                    showLegendKey: false,
                    position: 'ctr',
                },
            })
        )
        expect(model.dataLabels).toEqual({
            value: true,
            category: true,
            series: false,
            percent: true,
            position: 'ctr',
        })
    })

    it('maps the axis scales, including a log axis', () => {
        const model = chartInfoToModel(
            info({
                valAxisScale: {
                    min: 0,
                    max: 80,
                    majorUnit: 20,
                    logBase: 10,
                    reversed: true,
                },
                catAxisScale: {reversed: true},
            })
        )
        expect(model.valAxisScale).toEqual({
            min: 0,
            max: 80,
            majorUnit: 20,
            logBase: 10,
            reversed: true,
        })
        expect(model.catAxisScale?.reversed).toBe(true)
    })

    it('maps the of-pie split', () => {
        const model = chartInfoToModel(
            info({
                chartType: 'ofPie',
                ofPieSplit: {by: 'pos', pos: 2, secondSize: 75},
            })
        )
        expect(model.ofPieSplit).toEqual({by: 'pos', pos: 2, secondSize: 75})
    })

    it('carries a bubble series’ sizes and its source range', () => {
        const model = chartInfoToModel(
            info({
                chartType: 'bubble',
                series: [
                    {
                        name: 'S',
                        values: [1, 2],
                        formattedValues: ['1', '2'],
                        sizes: [10, 20],
                        sizeRef: 'Sheet1!$D$2:$D$3',
                        valRef: 'Sheet1!$C$2:$C$3',
                    },
                ],
            })
        )
        expect(model.series[0].sizes).toEqual([10, 20])
        expect(model.series[0].valRef).toBe('Sheet1!$C$2:$C$3')
    })

    it('carries a combo series’ own kind', () => {
        const model = chartInfoToModel(
            info({
                series: [
                    {
                        name: 'Bars',
                        values: [1],
                        formattedValues: ['1'],
                        sizes: [],
                    },
                    {
                        name: 'Line',
                        values: [2],
                        formattedValues: ['2'],
                        sizes: [],
                        seriesType: 'line',
                    },
                ],
            })
        )
        expect(model.series[0].seriesType).toBeUndefined()
        expect(model.series[1].seriesType).toBe('line')
    })

    it('passes a resolved series color through, and undefined when there is none', () => {
        const model = chartInfoToModel(
            info({
                series: [
                    {
                        name: 'S',
                        values: [1],
                        formattedValues: ['1'],
                        sizes: [],
                        color: '4472C4',
                    },
                    {
                        name: 'T',
                        values: [2],
                        formattedValues: ['2'],
                        sizes: [],
                    },
                ],
            })
        )
        expect(model.series[0].color).toBe('4472C4')
        expect(model.series[1].color).toBeUndefined()
    })
})
