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
    LineChart,
    PieChart,
    ScatterChart,
} from 'echarts/charts'
import {
    TitleComponent,
    LegendComponent,
    TooltipComponent,
    GridComponent,
    DatasetComponent,
} from 'echarts/components'
import {LabelLayout} from 'echarts/features'
import {CanvasRenderer} from 'echarts/renderers'

echarts.use([
    // Chart types. Column vs bar and area vs line are the same ECharts series
    // (`bar`/`line`) with different orientation / areaStyle — no extra module.
    BarChart,
    LineChart,
    PieChart,
    ScatterChart,
    // Components.
    TitleComponent,
    LegendComponent,
    TooltipComponent,
    GridComponent,
    DatasetComponent,
    // Features.
    LabelLayout,
    // Renderer. Canvas only — SVG renderer is intentionally not registered.
    CanvasRenderer,
])

export {echarts}
