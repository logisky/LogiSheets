<!--
  The editor for a selected chartEx chart (treemap, sunburst, funnel, box &
  whisker, histogram, Pareto, waterfall) — the sibling of ChartSettings.svelte,
  which edits classic charts.

  Every control maps to a field of the `UpdateChartEx` payload. The core
  patches the chart's part rather than regenerating it, so the styling Excel
  gave it survives. Kind-specific controls appear only for their kind, since
  the core refuses a field that does not fit. Edits commit on `change`.
-->
<script lang="ts">
    import type {ChartExInfo, UpdateChartEx} from 'logisheets-web'
    import {preservedChartLabel} from './preserved'

    type Patch = Omit<UpdateChartEx, 'sheetIdx' | 'chartId'>

    interface Props {
        ex: ChartExInfo
        /** The chart's layoutId, for the panel's heading. */
        kind: string
        onUpdate: (patch: Patch) => void
        onClose: () => void
    }

    let {ex, kind, onUpdate, onClose}: Props = $props()

    const hierarchy = $derived(ex.kind === 'treemap' || ex.kind === 'sunburst')
    const binned = $derived(ex.kind === 'histogram' && ex.binMode != null)

    const BIN_MODES = [
        {value: 'auto', label: 'Automatic'},
        {value: 'count', label: 'Number of bins'},
        {value: 'size', label: 'Bin width'},
    ]

    function setBinMode(mode: string) {
        if (mode === 'auto') return onUpdate({binMode: 'auto'})
        // Switching mode needs a value; start from the one shown, or a
        // sensible default the user then adjusts.
        const value = ex.binValue ?? (mode === 'count' ? 5 : 10)
        onUpdate({binMode: mode, binValue: value})
    }

    function setBinValue(raw: string) {
        const n = Number(raw)
        if (!Number.isFinite(n) || !ex.binMode || ex.binMode === 'auto') return
        onUpdate({binMode: ex.binMode, binValue: n})
    }

    function toggleTotal(i: number, on: boolean) {
        const set = new Set(ex.subtotals)
        if (on) set.add(i)
        else set.delete(i)
        onUpdate({subtotals: [...set].sort((a, b) => a - b)})
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
        <span>{preservedChartLabel(kind)}</span>
        <button class="close" onclick={onClose} aria-label="Close">×</button>
    </div>

    <label class="field">
        <span>Title</span>
        <input
            type="text"
            value={ex.title ?? ''}
            placeholder="No title"
            onchange={(e) => onUpdate({title: e.currentTarget.value})}
        />
    </label>

    <div class="group">
        <div class="group-head">Data</div>
        {#if ex.kind !== 'histogram' || ex.catRef}
            <label class="field">
                <span>{hierarchy ? 'Levels' : 'Categories'}</span>
                <input
                    type="text"
                    value={ex.catRef ?? ''}
                    placeholder="Sheet1!$A$2:$A$9"
                    onchange={(e) => onUpdate({catRef: e.currentTarget.value})}
                />
            </label>
        {/if}
        <label class="field">
            <span>{hierarchy ? 'Sizes' : 'Values'}</span>
            <input
                type="text"
                value={ex.valRef ?? ''}
                placeholder="Sheet1!$B$2:$B$9"
                onchange={(e) => onUpdate({valRef: e.currentTarget.value})}
            />
        </label>
        {#if hierarchy}
            <div class="hint">Several columns make levels, outermost on the left.</div>
        {/if}
    </div>

    {#if binned}
        <div class="group">
            <div class="group-head">Bins</div>
            <label class="field">
                <span>Bins</span>
                <select
                    value={ex.binMode}
                    onchange={(e) => setBinMode(e.currentTarget.value)}
                >
                    {#each BIN_MODES as m (m.value)}
                        <option value={m.value}>{m.label}</option>
                    {/each}
                </select>
            </label>
            {#if ex.binMode !== 'auto'}
                <label class="field">
                    <span>{ex.binMode === 'count' ? 'Count' : 'Width'}</span>
                    <input
                        type="number"
                        min={ex.binMode === 'count' ? 1 : 0}
                        step={ex.binMode === 'count' ? 1 : 'any'}
                        value={ex.binValue ?? ''}
                        onchange={(e) => setBinValue(e.currentTarget.value)}
                    />
                </label>
            {/if}
        </div>
    {/if}

    {#if ex.kind === 'boxWhisker'}
        <div class="group">
            <div class="group-head">Statistics</div>
            <label class="field">
                <span>Quartiles</span>
                <select
                    value={ex.quartileMethod ?? 'exclusive'}
                    onchange={(e) => onUpdate({quartileMethod: e.currentTarget.value})}
                >
                    <option value="exclusive">Exclusive median</option>
                    <option value="inclusive">Inclusive median</option>
                </select>
            </label>
            <label class="check">
                <input
                    type="checkbox"
                    checked={ex.showMean}
                    onchange={(e) => onUpdate({showMean: e.currentTarget.checked})}
                />
                <span>Mean markers</span>
            </label>
            <label class="check">
                <input
                    type="checkbox"
                    checked={ex.showOutliers}
                    onchange={(e) => onUpdate({showOutliers: e.currentTarget.checked})}
                />
                <span>Outlier points</span>
            </label>
        </div>
    {/if}

    {#if ex.kind === 'waterfall'}
        <div class="group">
            <div class="group-head">Totals</div>
            <div class="hint">A total is drawn from zero to its own value.</div>
            {#each ex.categories as c, i (i)}
                <label class="check">
                    <input
                        type="checkbox"
                        checked={ex.subtotals.includes(i)}
                        onchange={(e) => toggleTotal(i, e.currentTarget.checked)}
                    />
                    <span>{c || `Point ${i + 1}`}</span>
                </label>
            {/each}
        </div>
    {/if}
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

    .hint {
        color: #5f6368;
        font-size: 11px;
        margin-bottom: 4px;
    }
</style>
