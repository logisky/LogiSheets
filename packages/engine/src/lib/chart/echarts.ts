/**
 * Central ECharts registration — the tree-shaking lever.
 *
 * ECharts is pulled in through its `echarts/core` entry and only the chart
 * types + components we actually render are registered via `echarts.use([...])`.
 * A consumer's bundler (or our own lib build, which marks `echarts/*` external)
 * therefore ships only these modules, not the whole ~1MB library.
 *
 * To support a new chart type or feature: import it here and add it to the
 * `use([...])` call — nothing else in the codebase imports from `echarts`
 * directly, so this file is the single source of what gets bundled.
 */
import * as echarts from 'echarts/core'
import {
    BarChart,
    CandlestickChart,
    HeatmapChart,
    LineChart,
    PieChart,
    RadarChart,
    ScatterChart,
} from 'echarts/charts'
import {
    TitleComponent,
    LegendComponent,
    TooltipComponent,
    GridComponent,
    DatasetComponent,
    RadarComponent,
    VisualMapComponent,
} from 'echarts/components'
import {LabelLayout} from 'echarts/features'
import {CanvasRenderer} from 'echarts/renderers'

echarts.use([
    // Chart types. Column vs bar and area vs line are the same ECharts series
    // (`bar`/`line`) with different orientation / areaStyle — no extra module.
    BarChart,
    LineChart,
    PieChart,
    // Radar is its own series type; bubble is not — it is a scatter whose
    // points carry a `symbolSize`, so it needs no extra module.
    RadarChart,
    ScatterChart,
    // Stock renders as a candlestick. A surface has no 2-D equivalent in
    // ECharts core (the real thing needs echarts-gl), so it is drawn as a
    // heatmap of the same grid — which is what Excel's contour variants are.
    CandlestickChart,
    HeatmapChart,
    // Components.
    TitleComponent,
    LegendComponent,
    TooltipComponent,
    GridComponent,
    DatasetComponent,
    // The radar axis (its spokes and rings) is a component of its own.
    RadarComponent,
    // The heatmap's colour scale.
    VisualMapComponent,
    // Features.
    LabelLayout,
    // Renderer. Canvas only — SVG renderer is intentionally not registered.
    CanvasRenderer,
])

export {echarts}
