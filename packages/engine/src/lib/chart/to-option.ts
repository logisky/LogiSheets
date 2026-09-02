/**
 * Maps our library-agnostic {@link ChartModel} onto an ECharts option.
 *
 * This is the translation layer between the Excel-native chart model and the
 * rendering library. Keeping it isolated means swapping ECharts for another
 * renderer only touches this file plus `ChartView.svelte`.
 */
import type {EChartsOption} from 'echarts'
import type {
    AxisScale,
    ChartModel,
    ChartSeries,
    ChartType,
    DataLabels,
    LegendPosition,
} from './types'
import {formatAxisNumber} from './num-format'

/** Normalize an OOXML-style ARGB/RGB hex to a CSS color, or undefined. */
export function toCssColor(color?: string): string | undefined {
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

/** OOXML label positions → the nearest ECharts anchor, per series kind. */
function labelPosition(
    pos: string | undefined,
    kind: 'bar' | 'line' | 'pie'
): 'inside' | 'insideTop' | 'insideBottom' | 'top' | 'outside' {
    if (kind === 'pie')
        return pos === 'inEnd' || pos === 'ctr' ? 'inside' : 'outside'
    switch (pos) {
        case 'ctr':
            return 'inside'
        case 'inEnd':
            return 'insideTop'
        case 'inBase':
            return 'insideBottom'
        // `outEnd` and anything unrecognized sit just past the point, which is
        // also Excel's default for a bar/line label.
        default:
            return 'top'
    }
}

/**
 * The label spec for one series. The value text comes pre-formatted from the
 * core (`formattedValues`), so a label matches how the sheet renders the same
 * number; the category / series-name parts are joined the way Excel does, with
 * commas.
 */
function seriesLabel(
    model: ChartModel,
    s: ChartSeries,
    kind: 'bar' | 'line' | 'pie'
) {
    const labels = model.dataLabels
    if (!labels || !labelsOn(labels)) return {label: {show: false}}
    return {
        label: {
            show: true,
            position: labelPosition(labels.position, kind),
            formatter: (params: {dataIndex: number; percent?: number}) => {
                const parts: string[] = []
                if (labels.series && s.name) parts.push(s.name)
                if (labels.category) {
                    const c = model.categories[params.dataIndex]
                    if (c !== undefined) parts.push(String(c))
                }
                if (labels.value) {
                    const text = s.formattedValues?.[params.dataIndex]
                    const raw = s.values[params.dataIndex]
                    parts.push(text ?? (raw == null ? '' : String(raw)))
                }
                if (labels.percent && params.percent !== undefined)
                    parts.push(`${params.percent}%`)
                return parts.filter((p) => p !== '').join(', ')
            },
        },
    }
}

function labelsOn(l: DataLabels): boolean {
    return l.value || l.category || l.series || l.percent
}

/** Value-axis ticks rendered with the chart's number format, when it has one. */
function valueAxisLabel(model: ChartModel) {
    if (!model.valAxisNumFmt) return {}
    return {
        axisLabel: {
            formatter: (v: number) => formatAxisNumber(model.valAxisNumFmt, v),
        },
    }
}

/**
 * A fixed scale, where the chart sets one. Anything left undefined stays on
 * ECharts' own automatic bounds and tick spacing, which is what an "auto" axis
 * means in Excel too. A log axis needs `type: 'log'` rather than a bound.
 */
function axisScale(scale: AxisScale | undefined) {
    if (!scale) return {}
    return {
        ...(scale.min !== undefined ? {min: scale.min} : {}),
        ...(scale.max !== undefined ? {max: scale.max} : {}),
        ...(scale.majorUnit !== undefined ? {interval: scale.majorUnit} : {}),
        ...(scale.minorUnit !== undefined
            ? {minorTick: {show: true, splitNumber: 2}}
            : {}),
        ...(scale.logBase !== undefined
            ? {type: 'log' as const, logBase: scale.logBase}
            : {}),
        ...(scale.reversed ? {inverse: true} : {}),
    }
}

/**
 * The flat kind a 3-D one is drawn as. Depth is preserved in the file but not
 * rendered — drawing it would mean pulling in `echarts-gl`.
 */
const FLATTENED: Partial<Record<ChartType, ChartType>> = {
    col3d: 'col',
    bar3d: 'bar',
    line3d: 'line',
    area3d: 'area',
    pie3d: 'pie',
    surface3d: 'surface',
}

function flatten(type: ChartType): ChartType {
    return FLATTENED[type] ?? type
}

/** Cartesian charts: column, bar, line, area (all share axes + a series list). */
function cartesianOption(model: ChartModel): EChartsOption {
    const chartType = flatten(model.chartType)
    const horizontal = chartType === 'bar'
    const categoryAxis = {
        type: 'category' as const,
        data: model.categories.map((c) => String(c)),
        name: model.catAxisTitle,
        // A category axis has no numeric bounds; only its direction applies.
        ...(model.catAxisScale?.reversed ? {inverse: true} : {}),
    }
    const valueAxis = {
        type: 'value' as const,
        name: model.valAxisTitle,
        ...valueAxisLabel(model),
        ...axisScale(model.valAxisScale),
    }

    const series = model.series.map((s) => {
        // A combo chart's series may each name their own kind; the chart's own
        // kind is the default. Only the flat cartesian kinds can differ.
        const kind = flatten(s.seriesType ?? chartType)
        const isLine = kind === 'line' || kind === 'area'
        return {
            type: (isLine ? 'line' : 'bar') as 'line' | 'bar',
            name: s.name,
            data: s.values,
            // Stacking belongs to the chart's own kind, so an overridden
            // series is drawn beside the stack rather than in it.
            stack:
                model.stacked && kind === chartType ? 'total' : undefined,
            areaStyle: kind === 'area' ? {} : undefined,
            ...seriesColor(s),
            ...seriesLabel(model, s, isLine ? 'line' : 'bar'),
        }
    })

    // A log scale changes the axis' `type`, which ECharts models as a
    // discriminated union — the assembled object is cast, the same way the
    // series list is.
    return {
        xAxis: (horizontal ? valueAxis : categoryAxis) as EChartsOption['xAxis'],
        yAxis: (horizontal ? categoryAxis : valueAxis) as EChartsOption['yAxis'],
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
                ...(s ? seriesLabel(model, s, 'pie') : {}),
            },
        ],
    }
}

/**
 * Radar: one spoke per category, shared by every series. ECharts wants a single
 * max across the indicators, so it is taken from the data — leaving it
 * undefined makes each spoke self-scale, which misreads the shape.
 */
function radarOption(model: ChartModel): EChartsOption {
    const values = model.series.flatMap((s) =>
        s.values.filter((v): v is number => v != null)
    )
    const max = values.length ? Math.max(...values) : undefined
    return {
        radar: {
            indicator: model.categories.map((c) => ({name: String(c), max})),
        },
        series: [
            {
                type: 'radar',
                data: model.series.map((s) => ({
                    name: s.name,
                    value: s.values.map((v) => v ?? 0),
                    ...(toCssColor(s.color)
                        ? {itemStyle: {color: toCssColor(s.color)}}
                        : {}),
                })),
            },
        ],
    }
}

/**
 * Bubble: a scatter whose points carry a third value as their radius. Excel
 * sizes a bubble by *area*, so the radius goes as the square root; the largest
 * bubble in the chart is normalized to a fixed pixel size so one huge value
 * cannot swallow the plot.
 */
function bubbleOption(model: ChartModel): EChartsOption {
    const MAX_RADIUS = 40
    const DEFAULT_RADIUS = 10
    const largest = Math.max(
        0,
        ...model.series.flatMap((s) =>
            (s.sizes ?? []).map((v) => (v == null ? 0 : Math.abs(v)))
        )
    )
    const radius = (size: number | null | undefined) => {
        if (size == null || largest <= 0) return DEFAULT_RADIUS
        return Math.sqrt(Math.abs(size) / largest) * MAX_RADIUS
    }
    return {
        xAxis: {
            type: 'value',
            name: model.catAxisTitle,
            ...axisScale(model.catAxisScale),
        } as EChartsOption['xAxis'],
        yAxis: {
            type: 'value',
            name: model.valAxisTitle,
            ...valueAxisLabel(model),
            ...axisScale(model.valAxisScale),
        } as EChartsOption['yAxis'],
        series: model.series.map((s) => ({
            type: 'scatter' as const,
            name: s.name,
            // [x, y, size] — the third slot is what `symbolSize` reads.
            data: s.values.map((v, i) => [
                Number(model.categories[i] ?? i),
                v ?? null,
                s.sizes?.[i] ?? null,
            ]),
            symbolSize: (d: Array<number | null>) => radius(d[2]),
            ...seriesColor(s),
            ...seriesLabel(model, s, 'line'),
        })) as EChartsOption['series'],
    }
}

/**
 * Stock: the series *are* the price components, so they are read positionally
 * the way Excel does — four series is open/high/low/close, three is
 * high/low/close. ECharts wants [open, close, low, high] per point; an HLC
 * chart has no open, so open is set to the close, which draws the high-low
 * range with a tick at the close. Any other series count is not a stock shape
 * at all, so it falls back to plain lines rather than inventing prices.
 */
function stockOption(model: ChartModel): EChartsOption {
    const n = model.series.length
    if (n !== 3 && n !== 4) return cartesianOption(model)
    const [open, high, low, close] =
        n === 4
            ? [model.series[0], model.series[1], model.series[2], model.series[3]]
            : [model.series[2], model.series[0], model.series[1], model.series[2]]

    const at = (s: ChartSeries, i: number) => s.values[i] ?? null
    const data = model.categories.map((_, i) => [
        at(open, i),
        at(close, i),
        at(low, i),
        at(high, i),
    ])
    return {
        xAxis: {
            type: 'category',
            data: model.categories.map((c) => String(c)),
            name: model.catAxisTitle,
        } as EChartsOption['xAxis'],
        yAxis: {
            type: 'value',
            name: model.valAxisTitle,
            // Prices rarely start at zero, so let the axis frame the data.
            scale: true,
            ...valueAxisLabel(model),
            ...axisScale(model.valAxisScale),
        } as EChartsOption['yAxis'],
        series: [{type: 'candlestick', name: model.series[0]?.name, data}],
    }
}

/**
 * Split an of-pie chart's single series into the main plot and the second one,
 * the way `c:splitType` describes. Returns indices, so both plots can label
 * their slices from `categories`.
 */
function ofPieSplit(model: ChartModel): {main: number[]; second: number[]} {
    const values = model.series[0]?.values ?? []
    const all = values.map((_, i) => i)
    const split = model.ofPieSplit
    const pos = split?.pos
    let second: number[] = []
    switch (split?.by) {
        case 'pos':
            // The last N points, by position.
            second = pos ? all.slice(Math.max(0, all.length - pos)) : []
            break
        case 'val':
            second = pos == null ? [] : all.filter((i) => (values[i] ?? 0) < pos)
            break
        case 'percent': {
            const total = values.reduce<number>((a, v) => a + (v ?? 0), 0)
            second =
                pos == null || total === 0
                    ? []
                    : all.filter((i) => ((values[i] ?? 0) / total) * 100 < pos)
            break
        }
        default:
            // `auto` (and `cust`, whose per-point assignment we do not model):
            // Excel's default is the last two points.
            second = all.slice(Math.max(0, all.length - 2))
    }
    const inSecond = new Set(second)
    return {main: all.filter((i) => !inSecond.has(i)), second}
}

/**
 * Pie of pie / bar of pie: the main plot shows the points that were not split
 * off plus one slice standing for the rest, and the second plot breaks that
 * rest down. `barOfPie` draws the second plot as a stacked column instead.
 */
function ofPieOption(model: ChartModel): EChartsOption {
    const s = model.series[0]
    const values = s?.values ?? []
    const {main, second} = ofPieSplit(model)
    const label = (i: number) => String(model.categories[i] ?? i + 1)
    const value = (i: number) => values[i] ?? 0
    const rest = second.reduce((a, i) => a + value(i), 0)

    const mainData = main.map((i) => ({name: label(i), value: value(i)}))
    if (second.length) mainData.push({name: 'Other', value: rest})

    const asBar = model.chartType === 'barOfPie'
    // The second plot is sized relative to the first, as Excel does.
    const secondRadius = `${Math.min(60, ((model.ofPieSplit?.secondSize ?? 75) / 100) * 45)}%`

    const secondPlot = asBar
        ? second.map((i) => ({
              type: 'bar' as const,
              name: label(i),
              stack: 'other',
              data: [value(i)],
          }))
        : [
              {
                  type: 'pie' as const,
                  name: 'Other',
                  center: ['78%', '50%'],
                  radius: secondRadius,
                  data: second.map((i) => ({name: label(i), value: value(i)})),
              },
          ]

    return {
        // Only the bar form needs a cartesian frame, and only for its column.
        ...(asBar
            ? {
                  grid: {left: '58%', right: '6%', top: 24, bottom: 24},
                  xAxis: {type: 'category', data: ['Other'], show: false},
                  yAxis: {type: 'value', show: false},
              }
            : {}),
        series: [
            {
                type: 'pie',
                name: s?.name,
                center: asBar ? ['28%', '50%'] : ['26%', '50%'],
                radius: '55%',
                data: mainData,
            },
            ...secondPlot,
        ] as EChartsOption['series'],
    }
}

/**
 * Surface: a value grid, one series per row. ECharts core cannot draw a 3-D
 * surface (that needs echarts-gl, which this package deliberately does not
 * pull in), so it is rendered as a heatmap of the same grid — the flat contour
 * form of the same chart. `surface3d` is drawn the same way.
 */
function surfaceOption(model: ChartModel): EChartsOption {
    const data: Array<[number, number, number]> = []
    let min = Infinity
    let max = -Infinity
    model.series.forEach((s, row) => {
        s.values.forEach((v, col) => {
            if (v == null) return
            data.push([col, row, v])
            if (v < min) min = v
            if (v > max) max = v
        })
    })
    const finite = Number.isFinite(min) && Number.isFinite(max)
    return {
        xAxis: {
            type: 'category',
            data: model.categories.map((c) => String(c)),
            name: model.catAxisTitle,
        } as EChartsOption['xAxis'],
        yAxis: {
            type: 'category',
            data: model.series.map((s, i) => s.name ?? String(i + 1)),
            name: model.valAxisTitle,
        } as EChartsOption['yAxis'],
        visualMap: {
            min: finite ? min : 0,
            max: finite ? max : 1,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: 0,
        },
        series: [{type: 'heatmap', name: model.title, data}],
    }
}

/** Scatter: each series is a set of (x, y) pairs zipping categories × values. */
function scatterOption(model: ChartModel): EChartsOption {
    return {
        xAxis: {
            type: 'value',
            name: model.catAxisTitle,
            ...axisScale(model.catAxisScale),
        } as EChartsOption['xAxis'],
        yAxis: {
            type: 'value',
            name: model.valAxisTitle,
            ...valueAxisLabel(model),
            ...axisScale(model.valAxisScale),
        } as EChartsOption['yAxis'],
        series: model.series.map((s) => ({
            type: 'scatter' as const,
            name: s.name,
            data: s.values.map((v, i) => [
                Number(model.categories[i] ?? i),
                v ?? null,
            ]),
            ...seriesColor(s),
            ...seriesLabel(model, s, 'line'),
        })) as EChartsOption['series'],
    }
}

export function mapChartToOption(model: ChartModel): EChartsOption {
    let body: EChartsOption
    switch (flatten(model.chartType)) {
        case 'pie':
        case 'doughnut':
            body = pieOption(model)
            break
        case 'scatter':
            body = scatterOption(model)
            break
        case 'bubble':
            body = bubbleOption(model)
            break
        case 'radar':
            body = radarOption(model)
            break
        case 'stock':
            body = stockOption(model)
            break
        case 'ofPie':
        case 'barOfPie':
            body = ofPieOption(model)
            break
        case 'surface':
        case 'surface3d':
            body = surfaceOption(model)
            break
        default:
            body = cartesianOption(model)
    }

    const showLegend =
        !!model.legendPosition && model.legendPosition !== 'none'

    // Only the cartesian kinds sit in a `grid`; pie, radar and the XY kinds
    // place themselves, and only the axis-based ones get an axis tooltip.
    // `ofPie` places its own plots; `barOfPie` brings its own grid for the
    // column half, so neither takes the shared one.
    const flat = flatten(model.chartType)
    const gridless = [
        'pie',
        'doughnut',
        'radar',
        'ofPie',
        'barOfPie',
        'surface',
    ].includes(flat)
    const itemTooltip = [
        'scatter',
        'bubble',
        'radar',
        'pie',
        'doughnut',
        'ofPie',
        'barOfPie',
        'surface',
    ].includes(flat)
    return {
        title: model.title ? {text: model.title, left: 'center'} : undefined,
        legend: legendOption(model.legendPosition),
        tooltip: {trigger: itemTooltip ? 'item' : 'axis'},
        // Leave room for title/legend without hand-tuning per chart.
        grid: gridless
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
