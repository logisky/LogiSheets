<script lang="ts">
    import type { Grid } from '$types/index'
    import HeaderResizer from './HeaderResizer.svelte'

    interface Props {
        grid: Grid | null
        selectedRowRange?: [number, number]
        leftTopWidth?: number
        leftTopHeight?: number
        onSelectRow?: (row: number) => void
        onSelectRowRange?: (startRow: number, endRow: number) => void
        onContextMenu?: (row: number, e: MouseEvent) => void
        onResizeRow?: (rowIdx: number, deltaPx: number) => void
    }

    let {
        grid = null,
        selectedRowRange = undefined,
        leftTopWidth = 32,
        leftTopHeight = 24,
        onSelectRow,
        onSelectRowRange,
        onContextMenu,
        onResizeRow,
    }: Props = $props()

    let hostEl: HTMLDivElement | undefined = $state()

    function isSelected(rowIdx: number): boolean {
        if (!selectedRowRange) return false
        return rowIdx >= selectedRowRange[0] && rowIdx <= selectedRowRange[1]
    }

    function findRowIdxAt(y: number): number | undefined {
        if (!grid) return undefined
        let acc = -grid.subOffsetY
        for (const r of grid.rows) {
            acc += r.height
            if (y < acc) return r.idx
        }
        return grid.rows.at(-1)?.idx
    }

    function handleMouseDown(downIdx: number, e: MouseEvent) {
        if (e.button !== 0) return // left-click only
        e.preventDefault()
        e.stopPropagation()
        if (!grid) return

        // Initial single selection
        onSelectRow?.(downIdx)

        const handleMouseMove = (me: MouseEvent) => {
            const r = hostEl?.getBoundingClientRect()
            const y = me.clientY - (r?.top ?? 0)
            const currIdx = findRowIdxAt(y) ?? downIdx
            const start = Math.min(downIdx, currIdx)
            const end = Math.max(downIdx, currIdx)
            onSelectRowRange?.(start, end)
        }

        const handleMouseUp = (ue: MouseEvent) => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
            const r = hostEl?.getBoundingClientRect()
            const y = ue.clientY - (r?.top ?? 0)
            const upIdx = findRowIdxAt(y) ?? downIdx
            const start = Math.min(downIdx, upIdx)
            const end = Math.max(downIdx, upIdx)
            onSelectRowRange?.(start, end)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
    }

    function handleContextMenu(rowIdx: number, e: MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        
        // Select the row if not already selected
        if (!selectedRowRange || rowIdx < selectedRowRange[0] || rowIdx > selectedRowRange[1]) {
            onSelectRow?.(rowIdx)
        }
        
        onContextMenu?.(rowIdx, e)
    }

    // Compute positions using reduce pattern like the original React code
    function getRowPositions(rows: Grid['rows'], subOffsetY: number) {
        const result: { row: Grid['rows'][0]; y: number; bottomEdge: number }[] = []
        let y = -subOffsetY
        for (const row of rows) {
            result.push({ row, y, bottomEdge: y + row.height })
            y += row.height
        }
        return result
    }
</script>

<div
    class="row-headers"
    style="left: 0; top: {leftTopHeight}px; width: {leftTopWidth}px;"
    bind:this={hostEl}
>
    {#if grid?.rows}
        {#each getRowPositions(grid.rows, grid.subOffsetY) as { row, y, bottomEdge }}
            <button
                class="row-header"
                class:selected={isSelected(row.idx)}
                style="top: {y}px; height: {row.height}px;"
                onmousedown={(e) => handleMouseDown(row.idx, e)}
                oncontextmenu={(e) => handleContextMenu(row.idx, e)}
            >
                {row.idx + 1}
            </button>
            <!-- Resize handle at bottom edge of each row -->
            <HeaderResizer
                orientation="row"
                x={0}
                y={bottomEdge}
                length={leftTopWidth}
                onResizeEnd={(deltaPx) => onResizeRow?.(row.idx, deltaPx)}
            />
        {/each}
    {/if}
</div>

<style>
    .row-headers {
        position: absolute;
        bottom: 0;
        overflow: hidden;
        z-index: 1;
        background: #fafafa;
        border-right: 1px solid #e0e0e0;
    }

    .row-header {
        position: absolute;
        left: 0;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-bottom: 1px solid #eee;
        cursor: pointer;
        font-size: 12px;
        color: #333;
        padding: 0;
        box-sizing: border-box;
        user-select: none;
    }

    .row-header:hover {
        background: #e8e8e8;
    }

    .row-header.selected {
        background: #e3f2fd;
        color: #0d47a1;
        font-weight: 600;
    }
</style>
