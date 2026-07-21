/**
 * Adapts the WASM `ChartInfo` binding into the renderer's {@link ChartModel}.
 *
 * `ChartInfo` carries the chart's cached values and anchor; positioning is the
 * chart layer's job (via the grid), so this only reshapes the render fields.
 * When a chart has no explicit categories, we synthesize 1..n so cartesian
 * charts still get an axis.
 */
import type {ChartInfo} from 'logisheets-web'
import type {ChartModel, ChartType, LegendPosition} from './types'

export function chartInfoToModel(info: ChartInfo): ChartModel {
    const seriesLen = info.series[0]?.values.length ?? 0
    const categories =
        info.categories.length > 0
            ? [...info.categories]
            : Array.from({length: seriesLen}, (_, i) => i + 1)

    return {
        chartId: info.chartId,
        // The backend guarantees one of the known chart-type strings.
        chartType: info.chartType as ChartType,
        title: info.title,
        categories,
        series: info.series.map((s) => ({
            name: s.name,
            // `values` is typed readonly number[] by the generated binding but
            // carries nulls at runtime for gaps; the model allows both.
            values: [...s.values] as Array<number | null>,
            color: s.color ?? undefined,
        })),
        legendPosition: (info.legendPos as LegendPosition | undefined) ?? 'none',
        stacked: info.stacked,
        catAxisTitle: info.catAxisTitle,
        valAxisTitle: info.valAxisTitle,
    }
}
