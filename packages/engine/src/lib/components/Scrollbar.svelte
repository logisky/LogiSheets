<script lang="ts">
    interface Props {
        /** Used-range extent in pixels (from getSheetDimension). */
        totalLength: number
        /** Current scroll position (0..maxScroll). */
        position: number
        /** Visible viewport length in pixels. */
        visibleLength: number
        /** Scrollbar orientation. */
        orientation: 'x' | 'y'
        /** Called when position changes. */
        onChange?: (position: number) => void
        /** Called when a drag / button-repeat interaction ends. */
        onBlur?: () => void
        /** Pixels scrolled per end-button click. */
        step?: number
    }

    let {
        totalLength,
        position,
        visibleLength,
        orientation,
        onChange,
        onBlur,
        step = 30,
    }: Props = $props()

    const REPEAT_DELAY = 300 // ms before a held button starts repeating
    const REPEAT_INTERVAL = 50 // ms between repeats while held

    // Ref only — used to measure pixels on demand for dragging/paging. The
    // thumb itself is sized in CSS percentages, so it never depends on a
    // measured value being ready (that was the old "no thumb" bug).
    let trackEl: HTMLDivElement | undefined = $state()

    // The scrollable extent. Two things make it "Excel-like":
    //  1. It grows past the used range as you scroll (`position + visibleLength`),
    //     so scrolling down/right keeps working and shrinks the thumb.
    //  2. A half-viewport of headroom is always added, so even an empty sheet
    //     shows a distinct (shorter-than-track) thumb you can grab, and you can
    //     always scroll a little further.
    const headroom = $derived(visibleLength * 0.5)
    const effectiveTotal = $derived(
        Math.max(totalLength, position + visibleLength) + headroom
    )
    const maxScroll = $derived(Math.max(0, effectiveTotal - visibleLength))

    // Thumb size + offset as fractions (0..1) of the track — rendered as CSS
    // percentages so the thumb is always visible regardless of layout timing.
    const thumbFrac = $derived(
        effectiveTotal > 0 ? Math.min(visibleLength / effectiveTotal, 1) : 1
    )
    const offsetFrac = $derived(maxScroll > 0 ? position / maxScroll : 0)
    // Top/left of the thumb as a % of the track (thumb travels within the
    // 1 - thumbFrac of free space).
    const thumbStartPct = $derived(offsetFrac * (1 - thumbFrac) * 100)
    const thumbSizePct = $derived(thumbFrac * 100)

    function clamp(n: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, n))
    }

    // Thumb drag stays within the known extent.
    function scrollTo(docPos: number) {
        onChange?.(clamp(docPos, 0, maxScroll))
    }

    // Buttons, wheel and track-paging match the canvas wheel: scroll freely
    // past the used range (the engine renders blank cells there; the thumb
    // shrinks as effectiveTotal grows). Only the top is clamped.
    function scrollBy(delta: number) {
        onChange?.(Math.max(0, position + delta))
    }

    function trackPx(): number {
        if (!trackEl) return 0
        return orientation === 'x' ? trackEl.clientWidth : trackEl.clientHeight
    }

    // ---- Thumb drag: map pixel travel back to document position ----------
    function handleThumbMouseDown(e: MouseEvent) {
        e.stopPropagation()
        e.preventDefault()

        const startCoord = orientation === 'x' ? e.clientX : e.clientY
        const startPos = position
        const travelPx = Math.max(0, trackPx() * (1 - thumbFrac))

        function handleMouseMove(me: MouseEvent) {
            me.preventDefault()
            const cur = orientation === 'x' ? me.clientX : me.clientY
            const deltaDoc =
                travelPx > 0 ? ((cur - startCoord) / travelPx) * maxScroll : 0
            scrollTo(startPos + deltaDoc)
        }

        function handleMouseUp() {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
            onBlur?.()
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
    }

    // ---- Click on the empty track pages toward the click ------------------
    function handleTrackMouseDown(e: MouseEvent) {
        if (!trackEl) return
        const rect = trackEl.getBoundingClientRect()
        const clickPos =
            orientation === 'x' ? e.clientX - rect.left : e.clientY - rect.top
        const len = orientation === 'x' ? rect.width : rect.height
        const thumbStartPx = (thumbStartPct / 100) * len
        scrollBy(clickPos < thumbStartPx ? -visibleLength : visibleLength)
    }

    // ---- End buttons: single step, with hold-to-repeat --------------------
    let repeatTimeout: ReturnType<typeof setTimeout> | null = null
    let repeatInterval: ReturnType<typeof setInterval> | null = null

    function startRepeat(dir: number) {
        scrollBy(dir * step)
        repeatTimeout = setTimeout(() => {
            repeatInterval = setInterval(
                () => scrollBy(dir * step),
                REPEAT_INTERVAL
            )
        }, REPEAT_DELAY)
    }

    function stopRepeat() {
        if (repeatTimeout) {
            clearTimeout(repeatTimeout)
            repeatTimeout = null
        }
        if (repeatInterval) {
            clearInterval(repeatInterval)
            repeatInterval = null
        }
        onBlur?.()
    }

    function handleWheel(e: WheelEvent) {
        const delta = orientation === 'x' ? e.deltaX : e.deltaY
        if (delta !== 0) scrollBy(delta)
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="scrollbar {orientation}" onwheel={handleWheel}>
    <button
        class="btn"
        aria-label={orientation === 'x' ? 'Scroll left' : 'Scroll up'}
        onmousedown={(e) => {
            e.preventDefault()
            startRepeat(-1)
        }}
        onmouseup={stopRepeat}
        onmouseleave={stopRepeat}
    >
        <span class="arrow start"></span>
    </button>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="track" bind:this={trackEl} onmousedown={handleTrackMouseDown}>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
            class="thumb"
            style:width={orientation === 'x'
                ? `max(${thumbSizePct}%, 20px)`
                : undefined}
            style:height={orientation === 'y'
                ? `max(${thumbSizePct}%, 20px)`
                : undefined}
            style:left={orientation === 'x' ? `${thumbStartPct}%` : undefined}
            style:top={orientation === 'y' ? `${thumbStartPct}%` : undefined}
            onmousedown={handleThumbMouseDown}
        ></span>
    </div>

    <button
        class="btn"
        aria-label={orientation === 'x' ? 'Scroll right' : 'Scroll down'}
        onmousedown={(e) => {
            e.preventDefault()
            startRepeat(1)
        }}
        onmouseup={stopRepeat}
        onmouseleave={stopRepeat}
    >
        <span class="arrow end"></span>
    </button>
</div>

<style>
    .scrollbar {
        position: absolute;
        inset: 0;
        display: flex;
        box-sizing: border-box;
        background: #f0f0f0;
        user-select: none;
    }
    .scrollbar.x {
        flex-direction: row;
        border-top: 1px solid #d6d6d6;
    }
    .scrollbar.y {
        flex-direction: column;
        border-left: 1px solid #d6d6d6;
    }

    /* End buttons — square (sized off the strip thickness via aspect-ratio). */
    .btn {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: none;
        background: #f0f0f0;
        cursor: pointer;
    }
    .scrollbar.x .btn {
        height: 100%;
        aspect-ratio: 1;
    }
    .scrollbar.y .btn {
        width: 100%;
        aspect-ratio: 1;
    }
    .btn:hover {
        background: #dadada;
    }
    .btn:active {
        background: #b8b8b8;
    }

    /* Arrow glyphs drawn as CSS triangles so they stay crisp at any DPR. */
    .arrow {
        width: 0;
        height: 0;
    }
    .scrollbar.x .arrow.start {
        border-top: 4px solid transparent;
        border-bottom: 4px solid transparent;
        border-right: 5px solid #5a5a5a;
    }
    .scrollbar.x .arrow.end {
        border-top: 4px solid transparent;
        border-bottom: 4px solid transparent;
        border-left: 5px solid #5a5a5a;
    }
    .scrollbar.y .arrow.start {
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 5px solid #5a5a5a;
    }
    .scrollbar.y .arrow.end {
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 5px solid #5a5a5a;
    }
    .btn:active .arrow {
        filter: brightness(0.6);
    }

    .track {
        position: relative;
        flex: 1 1 auto;
        background: #f0f0f0;
    }

    .thumb {
        position: absolute;
        background: #c1c1c1;
        border-radius: 3px;
        cursor: default;
    }
    .scrollbar.x .thumb {
        top: 2px;
        bottom: 2px;
        min-width: 20px;
    }
    .scrollbar.y .thumb {
        left: 2px;
        right: 2px;
        min-height: 20px;
    }
    .thumb:hover {
        background: #a8a8a8;
    }
    .thumb:active {
        background: #7a7a7a;
    }
</style>
