<script lang="ts">
    /**
     * HeaderResizer - A draggable handle for resizing column widths or row heights.
     * Shows visual guides during drag operation.
     */

    interface Props {
        /** 'row' for row headers, 'col' for column headers */
        orientation: 'row' | 'col'
        /** Absolute X position inside the header container */
        x: number
        /** Absolute Y position inside the header container */
        y: number
        /** Length of the handle line (height for col, width for row) */
        length: number
        /** Optional thickness in px */
        thickness?: number
        /** Live resize delta callback (in px) */
        onResize?: (deltaPx: number) => void
        /** Commit resize delta callback (in px) */
        onResizeEnd?: (deltaPx: number) => void
    }

    let {
        orientation,
        x,
        y,
        length,
        thickness = 6,
        onResize,
        onResizeEnd,
    }: Props = $props()

    // State
    let dragging = $state(false)
    let delta = $state(0)
    let startPos: { x: number; y: number } | null = null

    function onMouseDown(e: MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        startPos = { x: e.clientX, y: e.clientY }
        dragging = true
        delta = 0

        const onMove = (me: MouseEvent) => {
            if (!startPos) return
            const dx = me.clientX - startPos.x
            const dy = me.clientY - startPos.y
            const d = orientation === 'col' ? dx : dy
            delta = d
            onResize?.(d)
        }

        const onUp = (ue: MouseEvent) => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            if (!startPos) return
            const dx = ue.clientX - startPos.x
            const dy = ue.clientY - startPos.y
            const d = orientation === 'col' ? dx : dy
            onResizeEnd?.(d)
            startPos = null
            dragging = false
            delta = 0
        }

        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }

    // Computed styles
    const handleStyle = $derived(
        orientation === 'col'
            ? `left: ${x - thickness / 2}px; top: ${y}px; width: ${thickness}px; height: ${length}px; cursor: col-resize;`
            : `left: ${x}px; top: ${y - thickness / 2}px; width: ${length}px; height: ${thickness}px; cursor: row-resize;`
    )

    const baseGuideStyle = $derived(
        orientation === 'col'
            ? `left: ${x - 1}px; top: 0; width: 2px; height: ${length}px;`
            : `left: 0; top: ${y - 1}px; width: ${length}px; height: 2px;`
    )

    const currGuideStyle = $derived(
        orientation === 'col'
            ? `left: ${x + delta - 1}px; top: 0; width: 2px; height: ${length}px;`
            : `left: 0; top: ${y + delta - 1}px; width: ${length}px; height: 2px;`
    )

    const badgeStyle = $derived(
        orientation === 'col'
            ? `left: ${x + delta + 6}px; top: 4px;`
            : `left: 4px; top: ${y + delta + 6}px;`
    )

    const badgeText = $derived(`${Math.round(delta * 10) / 10}px`)
</script>

<!-- Baseline (original) guide -->
{#if dragging}
    <div class="guide base-guide" style={baseGuideStyle}></div>
{/if}

<!-- Current (moving) guide -->
{#if dragging}
    <div class="guide curr-guide" style={currGuideStyle}></div>
{/if}

<!-- Pixel info badge -->
{#if dragging}
    <div class="badge" style={badgeStyle}>{badgeText}</div>
{/if}

<!-- Actual draggable handle -->
<div
    class="handle"
    style={handleStyle}
    onmousedown={onMouseDown}
    role="slider"
    aria-valuenow={delta}
    tabindex="-1"
></div>

<style>
    .handle {
        position: absolute;
        z-index: 3;
        background: transparent;
    }

    .handle:hover {
        background: rgba(31, 187, 125, 0.3);
    }

    .guide {
        position: absolute;
        pointer-events: none;
        z-index: 2;
    }

    .base-guide {
        background: rgba(0, 0, 0, 0.15);
    }

    .curr-guide {
        background: rgba(31, 187, 125, 0.8);
    }

    .badge {
        position: absolute;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        color: #fff;
        background: rgba(31, 187, 125, 0.85);
        pointer-events: none;
        z-index: 4;
        white-space: nowrap;
    }
</style>
