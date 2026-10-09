<script lang="ts">
    import type { Grid } from '$types/index'
    import { hiddenLineBoundaries, toA1notation } from './utils'
    import HeaderResizer from './HeaderResizer.svelte'

    interface Props {
        grid: Grid | null
        selectedColumnRange?: [number, number]
        leftTopWidth?: number
        leftTopHeight?: number
        onSelectColumn?: (col: number) => void
        onSelectColumnRange?: (startCol: number, endCol: number) => void
        onContextMenu?: (col: number, e: MouseEvent) => void
        onResizeCol?: (colIdx: number, deltaPx: number) => void
    }

    let {
        grid = null,
        selectedColumnRange = undefined,
        leftTopWidth = 32,
        leftTopHeight = 24,
        onSelectColumn,
        onSelectColumnRange,
        onContextMenu,
        onResizeCol,
    }: Props = $props()

    let hostEl: HTMLDivElement | undefined = $state()

    function isSelected(colIdx: number): boolean {
        if (!selectedColumnRange) return false
        return colIdx >= selectedColumnRange[0] && colIdx <= selectedColumnRange[1]
    }

    function findColIdxAt(x: number): number | undefined {
        if (!grid) return undefined
        let acc = -grid.subOffsetX
        for (const c of grid.columns) {
            acc += c.width
            if (x < acc) return c.idx
        }
        return grid.columns.at(-1)?.idx
    }

    function handleMouseDown(downIdx: number, e: MouseEvent) {
        if (e.button !== 0) return // left-click only
        e.preventDefault()
        e.stopPropagation()
        if (!grid) return

        // Initial single selection
        onSelectColumn?.(downIdx)

        const handleMouseMove = (me: MouseEvent) => {
            const r = hostEl?.getBoundingClientRect()
            const x = me.clientX - (r?.left ?? 0)
            const currIdx = findColIdxAt(x) ?? downIdx
            const start = Math.min(downIdx, currIdx)
            const end = Math.max(downIdx, currIdx)
            onSelectColumnRange?.(start, end)
        }

        const handleMouseUp = (ue: MouseEvent) => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
            const r = hostEl?.getBoundingClientRect()
            const x = ue.clientX - (r?.left ?? 0)
            const upIdx = findColIdxAt(x) ?? downIdx
            const start = Math.min(downIdx, upIdx)
            const end = Math.max(downIdx, upIdx)
            onSelectColumnRange?.(start, end)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
    }

    function handleContextMenu(colIdx: number, e: MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        
        // Select the column if not already selected
        if (!selectedColumnRange || colIdx < selectedColumnRange[0] || colIdx > selectedColumnRange[1]) {
            onSelectColumn?.(colIdx)
        }
        
        onContextMenu?.(colIdx, e)
    }

    // Compute positions using reduce pattern like the original React code
    function getColumnPositions(columns: Grid['columns'], subOffsetX: number) {
        const result: { col: Grid['columns'][0]; x: number; rightEdge: number }[] = []
        let x = -subOffsetX
        for (const col of columns) {
            result.push({ col, x, rightEdge: x + col.width })
            x += col.width
        }
        return result
    }
</script>

<div
    class="column-headers"
    style="left: {leftTopWidth}px; top: 0; height: {leftTopHeight}px;"
    bind:this={hostEl}
>
    {#if grid?.columns}
        {#each getColumnPositions(grid.columns, grid.subOffsetX) as { col, x, rightEdge }}
            <button
                class="column-header"
                class:selected={isSelected(col.idx)}
                style="left: {x}px; width: {col.width}px;"
                onmousedown={(e) => handleMouseDown(col.idx, e)}
                oncontextmenu={(e) => handleContextMenu(col.idx, e)}
            >
                {toA1notation(col.idx)}
            </button>
            <!-- Resize handle at right edge of each column -->
            <HeaderResizer
                orientation="col"
                x={rightEdge}
                y={0}
                length={leftTopHeight}
                onResizeEnd={(deltaPx) => onResizeCol?.(col.idx, deltaPx)}
            />
        {/each}
        {#each hiddenLineBoundaries(grid.columns.map((c) => ({ idx: c.idx, size: c.width })), grid.anchorX, grid.subOffsetX) as x}
            <div class="hidden-marker" style="left: {Math.max(0, x - 1.5)}px;"></div>
        {/each}
    {/if}
</div>

<style>
    .column-headers {
        position: absolute;
        right: 0;
        /* `clip`, not just `hidden`: a hidden overflow is still a scroll
           container, and focusing a header button that pokes past the edge
           (MUI hands focus back after a menu closes) scrolled it — sliding
           the headers off the grid they label. `hidden` stays as fallback. */
        overflow: hidden;
        overflow: clip;
        z-index: 1;
        background: #fafafa;
        border-bottom: 1px solid #e0e0e0;
    }

    /* Where columns are hidden: a thick rule across the boundary, so the gap
       in the lettering has something to point at. */
    .hidden-marker {
        position: absolute;
        top: 0;
        height: 100%;
        width: 3px;
        background: #8a8a8a;
        pointer-events: none;
    }

    .column-header {
        position: absolute;
        top: 0;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-right: 1px solid #eee;
        cursor: pointer;
        font-size: 12px;
        color: #333;
        padding: 0;
        box-sizing: border-box;
        user-select: none;
    }

    .column-header:hover {
        background: #e8e8e8;
    }

    .column-header.selected {
        background: #e3f2fd;
        color: #0d47a1;
        font-weight: 600;
    }
</style>
