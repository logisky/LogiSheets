/**
 * Rendering-side chart model.
 *
 * This is the *resolved* view a renderer consumes: category labels and numeric
 * values are already read out of the source cells. It is deliberately decoupled
 * from the OOXML-backed model the Rust core owns (`c:chartSpace`) and from the
 * WASM `ChartInfo` binding — the chart layer resolves the backend model's cell
 * references into this shape before handing it to ECharts, so the source of
 * truth stays Excel-native while the renderer stays library-agnostic.
 *
 * The 80% of Excel charts we target map onto these types; unsupported OOXML
 * settings round-trip through the core untouched and are simply not reflected
 * here.
 */

/**
 * The patch an editor sends to reconfigure an existing chart: every field of
 * the core's `UpdateChart` payload except the addressing ones, which the host
 * fills in. Anything left out keeps its current value.
 */
export type ChartUpdate = Omit<
    import('logisheets-web').UpdateChart,
    'sheetIdx' | 'chartId'
>

/**
 * The chart kinds we render. `col`/`bar` differ only in orientation; `area` is
 * a filled line; `doughnut` is a pie with a hole. Scatter uses (x, y) pairs and
 * `bubble` adds a third value sizing each point. `radar` plots one spoke per
 * category. `stock`'s series are the price components. `ofPie`/`barOfPie` split
 * one series across two plots. `surface`/`surface3d` are a value grid. The
 * `*3d` kinds render as their flat equivalents — the depth is preserved for
 * Excel but not drawn here.
 */
export type ChartType =
    | 'col'
    | 'bar'
    | 'line'
    | 'area'
    | 'pie'
    | 'doughnut'
    | 'scatter'
    | 'radar'
    | 'bubble'
    | 'stock'
    | 'ofPie'
    | 'barOfPie'
    | 'surface'
    | 'surface3d'
    | 'col3d'
    | 'bar3d'
    | 'line3d'
    | 'area3d'
    | 'pie3d'

export type LegendPosition = 'top' | 'bottom' | 'left' | 'right' | 'none'

export interface ChartSeries {
    /** Series name (legend entry). Resolved from the series-name reference. */
    name?: string
    /**
     * Y values (or, for scatter, the paired Y for each `categories` X). Cells
     * that are empty / non-numeric resolve to `null` so gaps render as gaps.
     */
    values: Array<number | null>
    /**
     * `values` already rendered with the label's number format, index-aligned.
     * Excel format codes are evaluated by the core (which owns the formatter),
     * so a data label shows these strings rather than re-deriving them.
     */
    formattedValues?: Array<string | null>
    /**
     * ARGB/RGB hex (e.g. "FF4472C4" or "4472C4"). Undefined → library default
     * palette.
     */
    color?: string
    /** The series' source range, e.g. `Sheet1!$B$2:$E$2`. */
    valRef?: string
    /**
     * Draw this series as a different kind than the chart's own — what makes a
     * combo chart. Undefined follows {@link ChartModel.chartType}.
     */
    seriesType?: ChartType
    /**
     * Bubble sizes, index-aligned with `values`. Only a bubble chart has them;
     * missing or non-numeric entries fall back to a default radius.
     */
    sizes?: Array<number | null>
    /** The bubble-size source range. */
    sizeRef?: string
}

/**
 * An axis' scale. Everything undefined (and `reversed` false) is a fully
 * automatic axis, which is what most charts have.
 */
export interface AxisScale {
    min?: number
    max?: number
    /** Log-scale base; undefined is a linear axis. */
    logBase?: number
    reversed: boolean
    /** Spacing between major ticks / gridlines. */
    majorUnit?: number
    minorUnit?: number
}

/**
 * What is drawn next to each data point. `show` false (the default) means no
 * labels at all; the other flags pick which parts make up the label text.
 */
export interface DataLabels {
    value: boolean
    category: boolean
    series: boolean
    percent: boolean
    /** OOXML `c:dLblPos`: ctr | inEnd | outEnd | inBase | bestFit. */
    position?: string
}

export interface ChartModel {
    /** Stable id from the backend; used as the render key. */
    chartId: string
    chartType: ChartType
    title?: string
    /**
     * Shared category / X-axis labels (cartesian charts) or slice names (pie).
     * For scatter these are the numeric X values. Length should match each
     * series' `values` length; mismatches are tolerated (zipped by index).
     */
    categories: Array<string | number>
    series: ChartSeries[]
    legendPosition?: LegendPosition
    /** Whether cartesian series stack (bar/area). Ignored by pie/scatter. */
    stacked?: boolean
    catAxisTitle?: string
    valAxisTitle?: string
    /** Point labels. Omitted / all-false means the chart shows none. */
    dataLabels?: DataLabels
    /**
     * Excel number-format code for the value axis ticks. Ticks are picked by
     * the renderer, so unlike data labels they are formatted host-side (see
     * `formatAxisNumber`, which covers the common numeric codes).
     */
    valAxisNumFmt?: string
    /** The category (X) source range, e.g. `Sheet1!$A$2:$A$5`. */
    catRef?: string
    /** Value-axis scale. Ignored by pie and doughnut, which have no axes. */
    valAxisScale?: AxisScale
    catAxisScale?: AxisScale
    /** How an of-pie chart divides its series between the two plots. */
    ofPieSplit?: OfPieSplit
    /**
     * Set when the chart plots a block rather than fixed ranges. `catRef` and
     * the series refs are then derived from that block as it is right now, so
     * showing them as something the user typed would be misleading — and a
     * chart that grows on its own has no ranges worth editing by hand.
     */
    blockSource?: ChartBlockSource
}

/** The block a chart follows, and which of its fields it plots. */
export interface ChartBlockSource {
    blockId: number
    categoryField?: string
    valueFields: readonly string[]
}

/**
 * The division between an of-pie chart's two plots, as authored. `by` picks how
 * `pos` is read: `pos` is a count of trailing points, `val` a threshold,
 * `percent` a share of the total.
 */
export interface OfPieSplit {
    by?: string
    pos?: number
    /** The second plot's size as a percentage of the first. */
    secondSize?: number
}
