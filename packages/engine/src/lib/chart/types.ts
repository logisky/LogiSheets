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
 * The chart kinds we render. `col`/`bar` differ only in orientation; `area` is
 * a filled line; `doughnut` is a pie with a hole. Scatter uses (x, y) pairs.
 */
export type ChartType =
    | 'col'
    | 'bar'
    | 'line'
    | 'area'
    | 'pie'
    | 'doughnut'
    | 'scatter'

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
     * ARGB/RGB hex (e.g. "FF4472C4" or "4472C4"). Undefined → library default
     * palette.
     */
    color?: string
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
}
