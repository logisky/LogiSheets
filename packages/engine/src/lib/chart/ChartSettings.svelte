<!--
  The editor for a selected chart — the equivalent of Excel's "Chart Elements"
  and "Format Chart" panes, condensed into one popover.

  Every control maps to a field of the `UpdateChart` payload; the core rewrites
  the chart's OOXML from it, so anything editable here round-trips to Excel.
  Edits are committed on `change` (not on every keystroke) so a transaction is
  sent per finished edit rather than per character.
-->
<script lang="ts">
    import type {
        AxisScaleUpdate,
        ChartInfo,
        CreateChartSeries,
        OfPieSplitUpdate,
        UpdateChart,
    } from 'logisheets-web'

    type Patch = Omit<UpdateChart, 'sheetIdx' | 'chartId'>

    interface Props {
        chart: ChartInfo
        onUpdate: (patch: Patch) => void
        onClose: () => void
    }

    let {chart, onUpdate, onClose}: Props = $props()

    const CHART_TYPES = [
        {value: 'col', label: 'Column'},
        {value: 'bar', label: 'Bar'},
        {value: 'line', label: 'Line'},
        {value: 'area', label: 'Area'},
        {value: 'pie', label: 'Pie'},
        {value: 'doughnut', label: 'Doughnut'},
        {value: 'scatter', label: 'Scatter'},
        {value: 'radar', label: 'Radar'},
        {value: 'bubble', label: 'Bubble'},
        {value: 'stock', label: 'Stock'},
        {value: 'ofPie', label: 'Pie of pie'},
        {value: 'barOfPie', label: 'Bar of pie'},
        {value: 'surface', label: 'Surface'},
        {value: 'surface3d', label: 'Surface (3-D)'},
        {value: 'col3d', label: 'Column (3-D)'},
        {value: 'bar3d', label: 'Bar (3-D)'},
        {value: 'line3d', label: 'Line (3-D)'},
        {value: 'area3d', label: 'Area (3-D)'},
        {value: 'pie3d', label: 'Pie (3-D)'},
    ]

    // Only these combine, so only they can be picked per series. The list
    // mirrors `ChartType::is_combinable` in the core.
    const SERIES_TYPES = [
        {value: '', label: 'Same as chart'},
        {value: 'col', label: 'Column'},
        {value: 'bar', label: 'Bar'},
        {value: 'line', label: 'Line'},
        {value: 'area', label: 'Area'},
    ]

    const LEGEND_POSITIONS = [
        {value: 'none', label: 'None'},
        {value: 'top', label: 'Top'},
        {value: 'bottom', label: 'Bottom'},
        {value: 'left', label: 'Left'},
        {value: 'right', label: 'Right'},
    ]

    const LABEL_POSITIONS = [
        {value: '', label: 'Default'},
        {value: 'ctr', label: 'Center'},
        {value: 'inEnd', label: 'Inside end'},
        {value: 'inBase', label: 'Inside base'},
        {value: 'outEnd', label: 'Outside end'},
    ]

    // Common Excel codes, offered as a datalist so the field stays free-form.
    const NUM_FORMATS = ['#,##0', '#,##0.00', '0%', '0.0%', '$#,##0.00', '0.0E+00']

    // Stacking and axes only mean something for the cartesian kinds. Radar has
    // categories but no editable axis, so it is deliberately not in this list.
    const cartesian = $derived(
        ['col', 'bar', 'line', 'area'].includes(chart.chartType)
    )
    // A per-series kind is only meaningful when the chart itself combines.
    const combinable = $derived(
        ['col', 'bar', 'line', 'area'].includes(chart.chartType)
    )
    const isBubble = $derived(chart.chartType === 'bubble')
    const isOfPie = $derived(
        chart.chartType === 'ofPie' || chart.chartType === 'barOfPie'
    )

    const SPLIT_TYPES = [
        {value: 'auto', label: 'Automatic'},
        {value: 'pos', label: 'By position'},
        {value: 'val', label: 'By value'},
        {value: 'percent', label: 'By percentage'},
    ]

    /** Like the axis scale, the split is replaced wholesale rather than patched. */
    function setSplit(patch: Partial<OfPieSplitUpdate>) {
        const s = chart.ofPieSplit
        onUpdate({
            ofPieSplit: {
                by: s.by,
                pos: s.pos,
                secondSize: s.secondSize,
                ...patch,
            },
        })
    }
    const isPie = $derived(chart.chartType === 'pie' || chart.chartType === 'doughnut')

    /**
     * The series list as an `UpdateChart` payload. `freezeColors` decides what
     * happens to colors the workbook theme owns: for an edit that keeps every
     * series in place we send no color at all, so the core keeps the theme
     * scheme color it already has. For add/remove the positions shift, so the
     * surviving series carry their resolved color explicitly rather than
     * inheriting the color of whatever now sits in their slot.
     */
    function seriesPayload(freezeColors: boolean): CreateChartSeries[] {
        return chart.series.map((s) => ({
            name: s.name,
            valueRef: s.valRef ?? '',
            color: freezeColors ? s.color : undefined,
            sizeRef: s.sizeRef,
            seriesType: s.seriesType,
        }))
    }

    function setSeries(i: number, patch: Partial<CreateChartSeries>) {
        const series = seriesPayload(false)
        series[i] = {...series[i], ...patch}
        onUpdate({series})
    }

    function removeSeries(i: number) {
        const series = seriesPayload(true)
        series.splice(i, 1)
        onUpdate({series})
    }

    function addSeries() {
        const series = seriesPayload(true)
        series.push({
            name: undefined,
            valueRef: '',
            color: undefined,
            sizeRef: undefined,
            seriesType: undefined,
        })
        onUpdate({series})
    }

    /**
     * The value axis' scale is sent whole — the payload replaces it rather
     * than patching it, which is what lets a field be cleared back to "auto".
     * So each edit re-sends the other fields as they stand.
     */
    function setScale(patch: Partial<AxisScaleUpdate>) {
        const s = chart.valAxisScale
        onUpdate({
            valAxisScale: {
                min: s.min,
                max: s.max,
                logBase: s.logBase,
                reversed: s.reversed,
                majorUnit: s.majorUnit,
                minorUnit: s.minorUnit,
                ...patch,
            },
        })
    }

    /** An empty box means "auto"; anything unparseable is ignored. */
    function numberOrAuto(raw: string): number | undefined {
        if (raw.trim() === '') return undefined
        const n = Number(raw)
        return Number.isFinite(n) ? n : undefined
    }

    /** `#rrggbb` for an `<input type="color">`, dropping any alpha prefix. */
    function toHexInput(color: string | undefined): string {
        if (!color) return '#4472c4'
        const hex = color.replace(/^#/, '')
        return `#${hex.length === 8 ? hex.slice(2) : hex}`
    }
</script>

<!-- Clicks inside the panel must not reach the chart (drag) or the grid
     (deselect), so the whole popover swallows mousedown. -->
<div
    class="chart-settings"
    role="dialog"
    tabindex="-1"
    aria-label="Chart settings"
    onmousedown={(e) => e.stopPropagation()}
>
    <div class="head">
        <span>Chart</span>
        <button class="close" onclick={onClose} aria-label="Close">×</button>
    </div>

    <label class="field">
        <span>Type</span>
        <select
            value={chart.chartType}
            onchange={(e) => onUpdate({chartType: e.currentTarget.value})}
        >
            {#each CHART_TYPES as t (t.value)}
                <option value={t.value}>{t.label}</option>
            {/each}
        </select>
    </label>

    <label class="field">
        <span>Title</span>
        <input
            type="text"
            value={chart.title ?? ''}
            placeholder="No title"
            onchange={(e) => onUpdate({title: e.currentTarget.value})}
        />
    </label>

    <label class="field">
        <span>Legend</span>
        <select
            value={chart.legendPos ?? 'none'}
            onchange={(e) => onUpdate({legendPos: e.currentTarget.value})}
        >
            {#each LEGEND_POSITIONS as p (p.value)}
                <option value={p.value}>{p.label}</option>
            {/each}
        </select>
    </label>

    {#if cartesian}
        <label class="check">
            <input
                type="checkbox"
                checked={chart.stacked}
                onchange={(e) => onUpdate({stacked: e.currentTarget.checked})}
            />
            <span>Stacked</span>
        </label>

        <label class="field">
            <span>X title</span>
            <input
                type="text"
                value={chart.catAxisTitle ?? ''}
                onchange={(e) => onUpdate({catAxisTitle: e.currentTarget.value})}
            />
        </label>
        <label class="field">
            <span>Y title</span>
            <input
                type="text"
                value={chart.valAxisTitle ?? ''}
                onchange={(e) => onUpdate({valAxisTitle: e.currentTarget.value})}
            />
        </label>

        <div class="group">
            <div class="group-head">Value axis</div>
            <div class="field">
                <span>Bounds</span>
                <input
                    type="number"
                    placeholder="Auto min"
                    value={chart.valAxisScale.min ?? ''}
                    onchange={(e) =>
                        setScale({min: numberOrAuto(e.currentTarget.value)})}
                />
                <input
                    type="number"
                    placeholder="Auto max"
                    value={chart.valAxisScale.max ?? ''}
                    onchange={(e) =>
                        setScale({max: numberOrAuto(e.currentTarget.value)})}
                />
            </div>
            <label class="field">
                <span>Unit</span>
                <input
                    type="number"
                    placeholder="Auto"
                    value={chart.valAxisScale.majorUnit ?? ''}
                    onchange={(e) =>
                        setScale({
                            majorUnit: numberOrAuto(e.currentTarget.value),
                        })}
                />
            </label>
            <label class="field">
                <span>Log base</span>
                <input
                    type="number"
                    placeholder="Linear"
                    min="2"
                    max="1000"
                    value={chart.valAxisScale.logBase ?? ''}
                    onchange={(e) =>
                        setScale({logBase: numberOrAuto(e.currentTarget.value)})}
                />
            </label>
            <label class="check">
                <input
                    type="checkbox"
                    checked={chart.valAxisScale.reversed}
                    onchange={(e) => setScale({reversed: e.currentTarget.checked})}
                />
                <span>Reverse direction</span>
            </label>
        </div>
    {/if}

    <div class="group">
        <div class="group-head">Data labels</div>
        <label class="check">
            <input
                type="checkbox"
                checked={chart.dataLabels.showValue}
                onchange={(e) => onUpdate({showDataLabels: e.currentTarget.checked})}
            />
            <span>Value</span>
        </label>
        <label class="check">
            <input
                type="checkbox"
                checked={chart.dataLabels.showCategory}
                onchange={(e) =>
                    onUpdate({showCategoryLabels: e.currentTarget.checked})}
            />
            <span>Category name</span>
        </label>
        <label class="check">
            <input
                type="checkbox"
                checked={chart.dataLabels.showSeries}
                onchange={(e) =>
                    onUpdate({showSeriesLabels: e.currentTarget.checked})}
            />
            <span>Series name</span>
        </label>
        {#if isPie}
            <label class="check">
                <input
                    type="checkbox"
                    checked={chart.dataLabels.showPercent}
                    onchange={(e) =>
                        onUpdate({showPercentLabels: e.currentTarget.checked})}
                />
                <span>Percentage</span>
            </label>
        {/if}
        <label class="field">
            <span>Position</span>
            <select
                value={chart.dataLabels.position ?? ''}
                onchange={(e) =>
                    onUpdate({dataLabelPosition: e.currentTarget.value})}
            >
                {#each LABEL_POSITIONS as p (p.value)}
                    <option value={p.value}>{p.label}</option>
                {/each}
            </select>
        </label>
    </div>

    <!-- One field drives both the label format and the axis format, which is
         how Excel's "linked to source" reads to a user. Pies have no axis, so
         the label format is the one to show back. -->
    <label class="field">
        <span>Number</span>
        <input
            type="text"
            list="chart-num-formats"
            value={chart.dataLabels.numFmt ?? chart.valAxisNumFmt ?? ''}
            placeholder="From cells"
            onchange={(e) => onUpdate({numFmt: e.currentTarget.value})}
        />
    </label>
    <datalist id="chart-num-formats">
        {#each NUM_FORMATS as f (f)}
            <option value={f}></option>
        {/each}
    </datalist>

    {#if isOfPie}
        <div class="group">
            <div class="group-head">Second plot</div>
            <label class="field">
                <span>Split</span>
                <select
                    value={chart.ofPieSplit.by ?? 'auto'}
                    onchange={(e) => setSplit({by: e.currentTarget.value})}
                >
                    {#each SPLIT_TYPES as t (t.value)}
                        <option value={t.value}>{t.label}</option>
                    {/each}
                </select>
            </label>
            <label class="field">
                <span>Value</span>
                <input
                    type="number"
                    placeholder="Auto"
                    value={chart.ofPieSplit.pos ?? ''}
                    onchange={(e) =>
                        setSplit({pos: numberOrAuto(e.currentTarget.value)})}
                />
            </label>
            <label class="field">
                <span>Size %</span>
                <input
                    type="number"
                    min="5"
                    max="200"
                    placeholder="75"
                    value={chart.ofPieSplit.secondSize ?? ''}
                    onchange={(e) =>
                        setSplit({secondSize: numberOrAuto(e.currentTarget.value)})}
                />
            </label>
        </div>
    {/if}

    <div class="group">
        <div class="group-head">Data</div>
        {#if chart.blockSource}
            <div class="bound">
                <strong
                    >Follows block {chart.blockSource.blockId}</strong
                >
                <span>
                    Plots {chart.blockSource.valueFields.join(', ')}{chart
                        .blockSource.categoryField
                        ? ` by ${chart.blockSource.categoryField}`
                        : ''}. The ranges below are worked out from the block,
                    so records added to it show up on their own — editing a
                    range by hand detaches the chart from the block.
                </span>
            </div>
        {/if}
        <label class="field">
            <span>Categories</span>
            <input
                type="text"
                value={chart.catRef ?? ''}
                placeholder="Sheet1!$A$2:$A$5"
                onchange={(e) => onUpdate({categoriesRef: e.currentTarget.value})}
            />
        </label>
        {#each chart.series as s, i (i)}
            <div class="series-row">
                <input
                    class="series-name"
                    type="text"
                    value={s.name ?? ''}
                    placeholder="Series {i + 1}"
                    onchange={(e) => setSeries(i, {name: e.currentTarget.value})}
                />
                <input
                    class="series-ref"
                    type="text"
                    value={s.valRef ?? ''}
                    placeholder="Sheet1!$B$2:$B$5"
                    onchange={(e) =>
                        setSeries(i, {valueRef: e.currentTarget.value})}
                />
                <input
                    class="series-color"
                    type="color"
                    value={toHexInput(s.color)}
                    aria-label="Series color"
                    onchange={(e) =>
                        setSeries(i, {
                            color: e.currentTarget.value.replace('#', ''),
                        })}
                />
                <button
                    class="series-remove"
                    aria-label="Remove series"
                    onclick={() => removeSeries(i)}>×</button
                >
            </div>
            {#if combinable}
                <label class="field">
                    <span>Draw as</span>
                    <select
                        value={s.seriesType ?? ''}
                        onchange={(e) =>
                            setSeries(i, {
                                seriesType: e.currentTarget.value,
                            })}
                    >
                        {#each SERIES_TYPES as t (t.value)}
                            <option value={t.value}>{t.label}</option>
                        {/each}
                    </select>
                </label>
            {/if}
            {#if isBubble}
                <label class="field">
                    <span>Sizes</span>
                    <input
                        type="text"
                        value={s.sizeRef ?? ''}
                        placeholder="Sheet1!$D$2:$D$5"
                        onchange={(e) =>
                            setSeries(i, {sizeRef: e.currentTarget.value})}
                    />
                </label>
            {/if}
        {/each}
        <button class="add-series" onclick={addSeries}>+ Add series</button>
    </div>
</div>

<style>
    .chart-settings {
        position: absolute;
        top: 0;
        left: calc(100% + 8px);
        width: 250px;
        max-height: 420px;
        overflow-y: auto;
        padding: 8px 10px 10px;
        box-sizing: border-box;
        background: #fff;
        border: 1px solid #d0d0d0;
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
        font-size: 12px;
        color: #202124;
        pointer-events: auto;
        z-index: 3;
        cursor: default;
    }

    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-weight: 600;
        margin-bottom: 6px;
    }

    .close {
        border: none;
        background: none;
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
        color: #5f6368;
        padding: 0 2px;
    }

    .field {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 5px;
    }

    .field > span {
        flex: 0 0 62px;
        color: #5f6368;
    }

    .field input,
    .field select {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 12px;
        padding: 2px 4px;
        border: 1px solid #dadce0;
        border-radius: 3px;
        background: #fff;
    }

    .check {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
    }

    .group {
        border-top: 1px solid #eee;
        margin-top: 8px;
        padding-top: 6px;
    }

    .group-head {
        font-weight: 600;
        margin-bottom: 4px;
    }

    .bound {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-bottom: 6px;
        padding: 6px 8px;
        border-left: 3px solid #4c6ef5;
        border-radius: 3px;
        background: #eef2ff;
        line-height: 1.35;
    }

    .bound strong {
        font-weight: 600;
    }

    .bound span {
        color: #4a5568;
        font-size: 11px;
    }

    .series-row {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 4px;
    }

    .series-name {
        flex: 1 1 34%;
        min-width: 0;
    }

    .series-ref {
        flex: 1 1 66%;
        min-width: 0;
    }

    .series-row input[type='text'] {
        font-size: 12px;
        padding: 2px 4px;
        border: 1px solid #dadce0;
        border-radius: 3px;
    }

    .series-color {
        flex: 0 0 22px;
        width: 22px;
        height: 20px;
        padding: 0;
        border: 1px solid #dadce0;
        border-radius: 3px;
        background: #fff;
    }

    .series-remove {
        flex: 0 0 auto;
        border: none;
        background: none;
        color: #5f6368;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        padding: 0 2px;
    }

    .add-series {
        margin-top: 2px;
        border: 1px dashed #dadce0;
        background: #fff;
        border-radius: 3px;
        font-size: 12px;
        padding: 2px 6px;
        cursor: pointer;
        color: #1a73e8;
    }
</style>
