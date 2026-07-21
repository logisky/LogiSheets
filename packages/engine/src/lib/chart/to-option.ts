/**
 * Maps our library-agnostic {@link ChartModel} onto an ECharts option.
 *
 * This is the translation layer between the Excel-native chart model and the
 * rendering library. Keeping it isolated means swapping ECharts for another
 * renderer only touches this file plus `ChartView.svelte`.
 */
import type {EChartsOption} from 'echarts'
import type {ChartModel, ChartSeries, LegendPosition} from './types'

/** Normalize an OOXML-style ARGB/RGB hex to a CSS color, or undefined. */
function toCssColor(color?: string): string | undefined {
    if (!color) return undefined
    const hex = color.trim().replace(/^#/, '')
    // ARGB (8 hex) → drop the leading alpha; keep RGB (6 hex) as-is.
    if (hex.length === 8) return `#${hex.slice(2)}`
    if (hex.length === 6) return `#${hex}`
    return undefined
}

function legendOption(
    pos: LegendPosition | undefined
): EChartsOption['legend'] {
    switch (pos) {
        case 'top':
            return {show: true, top: 0}
        case 'bottom':
            return {show: true, bottom: 0}
        case 'left':
            return {show: true, left: 0, orient: 'vertical'}
        case 'right':
            return {show: true, right: 0, orient: 'vertical'}
        default:
            return {show: false}
    }
}

function seriesColor(s: ChartSeries) {
    const c = toCssColor(s.color)
    return c ? {itemStyle: {color: c}} : {}
}

/** Cartesian charts: column, bar, line, area (all share axes + a series list). */
function cartesianOption(model: ChartModel): EChartsOption {
    const {chartType} = model
    const horizontal = chartType === 'bar'
    const categoryAxis = {
        type: 'category' as const,
        data: model.categories.map((c) => String(c)),
        name: model.catAxisTitle,
    }
    const valueAxis = {
        type: 'value' as const,
        name: model.valAxisTitle,
    }

    const series = model.series.map((s) => {
        const isLine = chartType === 'line' || chartType === 'area'
        return {
            type: (isLine ? 'line' : 'bar') as 'line' | 'bar',
            name: s.name,
            data: s.values,
            stack: model.stacked ? 'total' : undefined,
            areaStyle: chartType === 'area' ? {} : undefined,
            ...seriesColor(s),
        }
    })

    return {
        xAxis: horizontal ? valueAxis : categoryAxis,
        yAxis: horizontal ? categoryAxis : valueAxis,
        series: series as EChartsOption['series'],
    }
}

/** Pie / doughnut: a single ring built from the first series' values. */
function pieOption(model: ChartModel): EChartsOption {
    const s = model.series[0]
    const data = (s?.values ?? []).map((v, i) => ({
        name: String(model.categories[i] ?? i + 1),
        value: v ?? 0,
    }))
    return {
        series: [
            {
                type: 'pie',
                name: s?.name,
                radius: model.chartType === 'doughnut' ? ['45%', '70%'] : '70%',
                data,
            },
        ],
    }
}

/** Scatter: each series is a set of (x, y) pairs zipping categories × values. */
function scatterOption(model: ChartModel): EChartsOption {
    return {
        xAxis: {type: 'value', name: model.catAxisTitle},
        yAxis: {type: 'value', name: model.valAxisTitle},
        series: model.series.map((s) => ({
            type: 'scatter' as const,
            name: s.name,
            data: s.values.map((v, i) => [
                Number(model.categories[i] ?? i),
                v ?? null,
            ]),
            ...seriesColor(s),
        })) as EChartsOption['series'],
    }
}

export function mapChartToOption(model: ChartModel): EChartsOption {
    let body: EChartsOption
    switch (model.chartType) {
        case 'pie':
        case 'doughnut':
            body = pieOption(model)
            break
        case 'scatter':
            body = scatterOption(model)
            break
        default:
            body = cartesianOption(model)
    }

    const showLegend =
        !!model.legendPosition && model.legendPosition !== 'none'

    return {
        title: model.title ? {text: model.title, left: 'center'} : undefined,
        legend: legendOption(model.legendPosition),
        tooltip: {trigger: model.chartType === 'scatter' ? 'item' : 'axis'},
        // Leave room for title/legend without hand-tuning per chart.
        grid:
            model.chartType === 'pie' || model.chartType === 'doughnut'
                ? undefined
                : {
                      top: model.title ? 40 : 16,
                      bottom: showLegend ? 40 : 24,
                      left: 48,
                      right: 24,
                      containLabel: true,
                  },
        ...body,
    }
}
