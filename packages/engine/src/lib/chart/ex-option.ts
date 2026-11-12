/**
 * Maps a chartEx chart — `ChartInfo.ex`, already reduced by the core to what
 * is plotted — onto an ECharts option.
 *
 * The statistics (quartiles, bins, running shares) are the core's, computed
 * with Excel's rules; this only lays them out. Each kind maps to the nearest
 * ECharts form: treemap, sunburst, funnel and boxplot natively; a waterfall
 * as stacked bars over an invisible base; a histogram as touching bars; a
 * Pareto as bars plus a cumulative-percent line on a second axis.
 */
import type {EChartsOption} from 'echarts'
import type {ChartExInfo} from 'logisheets-web'
import {formatAxisNumber} from './num-format'

/** Excel's default waterfall colours: increase, decrease, total. */
export const WATERFALL_COLORS = {
    up: '#4472C4',
    down: '#ED7D31',
    total: '#A5A5A5',
}

export function chartExToOption(info: ChartExInfo): EChartsOption {
    const title = info.title
        ? {text: info.title, left: 'center' as const}
        : undefined
    const top = info.title ? 40 : 16
    switch (info.kind) {
        case 'treemap':
            return {
                title,
                tooltip: {trigger: 'item'},
                series: [
                    {
                        type: 'treemap',
                        top,
                        roam: false,
                        nodeClick: false,
                        breadcrumb: {show: false},
                        data: treeData(info),
                        // Parents carry their name in a band above their
                        // children, as Excel's "overlapping" labels do.
                        upperLabel: {show: true, height: 18},
                        levels: [
                            {itemStyle: {gapWidth: 2}},
                            {itemStyle: {gapWidth: 1}},
                        ],
                    },
                ],
            }
        case 'sunburst':
            return {
                title,
                tooltip: {trigger: 'item'},
                series: [
                    {
                        type: 'sunburst',
                        center: ['50%', info.title ? '55%' : '50%'],
                        radius: ['0%', '85%'],
                        nodeClick: false,
                        data: treeData(info),
                        label: {rotate: 'radial'},
                    },
                ],
            }
        case 'funnel':
            return {
                title,
                tooltip: {trigger: 'item'},
                series: [
                    {
                        type: 'funnel',
                        top,
                        bottom: 8,
                        // Excel keeps the stages in sheet order.
                        sort: 'none',
                        gap: 2,
                        label: {
                            position: 'inside',
                            formatter: (p) =>
                                `${p.name}  ${info.formattedValues[p.dataIndex] ?? p.value}`,
                        },
                        data: info.categories.map((name, i) => ({
                            name,
                            value: info.values[i],
                        })),
                    },
                ],
            }
        case 'waterfall':
            return waterfallOption(info, title, top)
        case 'boxWhisker':
            return boxOption(info, title, top)
        case 'histogram':
        case 'pareto':
            return columnsOption(info, title, top)
        default:
            return {title}
    }
}

interface TreeItem {
    name: string
    value: number
    children?: TreeItem[]
}

/** Rebuild the core's flattened hierarchy (parent indices) as a tree. */
export function treeData(info: ChartExInfo): TreeItem[] {
    const items: TreeItem[] = info.nodes.map((n) => ({
        name: n.name,
        value: n.value,
    }))
    const roots: TreeItem[] = []
    info.nodes.forEach((n, i) => {
        if (n.parent == null) {
            roots.push(items[i])
        } else {
            const p = items[n.parent]
            ;(p.children ??= []).push(items[i])
        }
    })
    return roots
}

/**
 * Each waterfall point as the three stacked segments that draw it: an
 * invisible `base` it floats on, and the visible part above (`up`) and below
 * (`down`) zero. A bar that crosses zero needs both visible parts, since a
 * stack grows away from zero on each side.
 */
export function waterfallSegments(
    values: readonly number[],
    subtotals: readonly number[]
): Array<{base: number; up: number; down: number; kind: keyof typeof WATERFALL_COLORS}> {
    let running = 0
    return values.map((v, i) => {
        const total = subtotals.includes(i)
        // A total is drawn from zero to its own value and restarts the run.
        const start = total ? 0 : running
        const end = total ? v : running + v
        running = end
        const lo = Math.min(start, end)
        const hi = Math.max(start, end)
        const kind = total ? 'total' : v >= 0 ? 'up' : 'down'
        if (lo >= 0) return {base: lo, up: hi - lo, down: 0, kind}
        if (hi <= 0) return {base: hi, up: 0, down: lo - hi, kind}
        return {base: 0, up: hi, down: lo, kind}
    })
}

function waterfallOption(
    info: ChartExInfo,
    title: EChartsOption['title'],
    top: number
): EChartsOption {
    const segs = waterfallSegments(info.values, info.subtotals)
    const colored = (pick: (s: (typeof segs)[number]) => number) =>
        segs.map((s) => ({
            value: pick(s),
            itemStyle: {color: WATERFALL_COLORS[s.kind]},
        }))
    return {
        title,
        tooltip: {
            trigger: 'axis',
            axisPointer: {type: 'shadow'},
            formatter: (params) => {
                const first = Array.isArray(params) ? params[0] : params
                const i = first.dataIndex
                return `${info.categories[i]}: ${info.formattedValues[i] ?? info.values[i]}`
            },
        },
        grid: {top, bottom: 24, left: 48, right: 24, containLabel: true},
        xAxis: {type: 'category', data: [...info.categories]},
        yAxis: {
            type: 'value',
            axisLabel: {formatter: (v: number) => formatAxisNumber(info.numFmt, v)},
        },
        series: [
            {
                type: 'bar',
                stack: 'waterfall',
                silent: true,
                itemStyle: {color: 'transparent'},
                data: segs.map((s) => s.base),
            },
            {type: 'bar', stack: 'waterfall', data: colored((s) => s.up)},
            {type: 'bar', stack: 'waterfall', data: colored((s) => s.down)},
        ],
    }
}

function boxOption(
    info: ChartExInfo,
    title: EChartsOption['title'],
    top: number
): EChartsOption {
    // Categories across every series, in first-seen order.
    const cats: string[] = []
    for (const s of info.boxSeries)
        for (const b of s.boxes) if (!cats.includes(b.category)) cats.push(b.category)
    const series: NonNullable<EChartsOption['series']> = []
    info.boxSeries.forEach((s, si) => {
        const at = (c: string) => s.boxes.find((b) => b.category === c)
        series.push({
            type: 'boxplot',
            name: s.name ?? `Series ${si + 1}`,
            data: cats.map((c) => {
                const b = at(c)
                return b ? [b.min, b.q1, b.median, b.q3, b.max] : []
            }),
        })
        if (info.showMean)
            series.push({
                type: 'scatter',
                name: s.name ?? `Series ${si + 1}`,
                symbol: 'path://M0,0L10,10M10,0L0,10',
                symbolSize: 8,
                itemStyle: {borderColor: '#333', borderWidth: 1.5},
                data: s.boxes.map((b) => [cats.indexOf(b.category), b.mean]),
            })
        if (info.showOutliers)
            series.push({
                type: 'scatter',
                name: s.name ?? `Series ${si + 1}`,
                symbolSize: 6,
                data: s.boxes.flatMap((b) =>
                    b.outliers.map((o) => [cats.indexOf(b.category), o])
                ),
            })
    })
    return {
        title,
        tooltip: {trigger: 'item'},
        legend: info.boxSeries.length > 1 ? {bottom: 0} : undefined,
        grid: {
            top,
            bottom: info.boxSeries.length > 1 ? 40 : 24,
            left: 48,
            right: 24,
            containLabel: true,
        },
        xAxis: {type: 'category', data: cats},
        yAxis: {
            type: 'value',
            scale: true,
            axisLabel: {formatter: (v: number) => formatAxisNumber(info.numFmt, v)},
        },
        series,
    }
}

function columnsOption(
    info: ChartExInfo,
    title: EChartsOption['title'],
    top: number
): EChartsOption {
    const pareto = info.kind === 'pareto'
    const yAxis: NonNullable<EChartsOption['yAxis']> = [
        {
            type: 'value',
            axisLabel: {formatter: (v: number) => formatAxisNumber(info.numFmt, v)},
        },
    ]
    if (pareto)
        yAxis.push({
            type: 'value',
            min: 0,
            max: 100,
            splitLine: {show: false},
            axisLabel: {formatter: '{value}%'},
        })
    const series: NonNullable<EChartsOption['series']> = [
        {
            type: 'bar',
            name: info.seriesName ?? undefined,
            // Bins of a histogram sit almost edge to edge.
            barCategoryGap: pareto ? '20%' : '4%',
            data: [...info.values],
        },
    ]
    if (pareto)
        series.push({
            type: 'line',
            yAxisIndex: 1,
            symbolSize: 5,
            itemStyle: {color: WATERFALL_COLORS.down},
            data: info.cumulativePercent.map((p) => Math.round(p * 100) / 100),
        })
    return {
        title,
        tooltip: {trigger: 'axis'},
        grid: {top, bottom: 24, left: 48, right: pareto ? 48 : 24, containLabel: true},
        xAxis: {type: 'category', data: [...info.categories]},
        yAxis,
        series,
    }
}
