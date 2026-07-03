<script lang="ts">
    import { onMount } from 'svelte'
    import type { Grid, CellLayout, EngineConfig, DEFAULT_ENGINE_CONFIG } from '$types/index'
    import type { SelectedData, SheetInfo, Transaction, EditPayload, StyleUpdateType } from 'logisheets-web'
    import { isErrorMessage } from 'logisheets-web'
    import { DataService } from '$lib/clients/service'
    // Inlined (base64 blob) so the published bundle is self-contained — see
    // the matching import in engine.ts for why a separate worker asset breaks
    // external consumers.
    import MyWorker from '../worker/worker.ts?worker&inline'
    import {
        match,
        xForColStart,
        xForColEnd,
        yForRowStart,
        yForRowEnd,
        getSelectedCellRange,
        getSelectedLines,
        getSelectedRows,
        getSelectedColumns,
        findVisibleRowIdxRange,
        findVisibleColIdxRange,
        buildSelectedDataFromCell,
        buildSelectedDataFromCellRange,
        buildSelectedDataFromLines,
        ptToPx,
        pxToPt,
        pxToWidth,
        widthToPx,
        simpleUuid,
    } from './utils'
    import ColumnHeaders from './ColumnHeaders.svelte'
    import RowHeaders from './RowHeaders.svelte'
    import Selector from './Selector.svelte'
    import SheetTabs from './SheetTabs.svelte'
    import Scrollbar from './Scrollbar.svelte'
    import type { ContextMenuContext } from './contextMenuTypes'
    import { dispatchShortcut, type ShortcutHandlers } from './shortcuts'

// Auto-scroll constants
const AUTO_SCROLL_THRESHOLD = 32; // pixels from edge to trigger scroll
const AUTO_SCROLL_SPEED = 30; // pixels per scroll tick
const AUTO_SCROLL_INTERVAL = 50; // ms between scroll ticks

// Auto-scroll state
let dragScrollInterval: ReturnType<typeof setInterval> | null = null;
let lastDragMouseEvent: MouseEvent | null = null;
let isScrolling = false;
let isDragging = false; // True while user is drag-selecting

    // ========================================================================
    // Props
    // ========================================================================

    interface Props {
        /** OffscreenCanvas id for this view in the shared worker */
        canvasId?: number
        /** Currently selected data */
        selectedData?: SelectedData
        /** Active sheet index */
        activeSheet?: number
        /** Cell layouts for custom rendering */
        cellLayouts?: CellLayout[]
        /** Engine configuration */
        config?: Partial<EngineConfig>
        /** Show sheet tabs at bottom */
        showSheetTabs?: boolean
        /** Show scrollbars */
        showScrollbars?: boolean
        /** Callback when selection changes */
        onSelectedDataChange?: (data: SelectedData) => void
        /** Callback when active sheet changes */
        onActiveSheetChange?: (sheet: number) => void
        /** Callback when grid updates */
        onGridChange?: (grid: Grid | null) => void
        /** Callback when sheets list changes */
        onSheetsChange?: (sheets: readonly SheetInfo[]) => void
        /**
         * The user opened the context menu (right-clicked a cell or a
         * row/column header). The engine renders no menu itself — the host
         * uses this to render its own menu at `(x, y)` (viewport coords).
         */
        onContextMenu?: (context: ContextMenuContext, x: number, y: number) => void
        /** Callback when user wants to start editing a cell (double-click or direct typing) */
        onStartEdit?: (row: number, col: number, initialText: string) => void
        /** Callback when an invalid formula is entered */
        onInvalidFormula?: () => void
        /** Callback for the Save shortcut (Ctrl/⌘+S) — host decides how to persist. */
        onSave?: () => void
        /** Ctrl/⌘+Arrow found no data/block boundary ahead — host may show a hint. */
        onNoDataBoundary?: (direction: 'up' | 'down' | 'left' | 'right') => void
        /** External data service (when used via Engine.mount()) */
        dataService?: DataService | null
        /** Getter for whether a formula is being edited (prevents canvas from taking focus) */
        getIsEditingFormula?: () => boolean
    }

    let {
        canvasId = 0,
        selectedData = $bindable({ source: 'none' }),
        activeSheet = $bindable(0),
        cellLayouts = [],
        config = {},
        showSheetTabs = true,
        showScrollbars = true,
        onSelectedDataChange,
        onActiveSheetChange,
        onGridChange,
        onSheetsChange,
        onContextMenu,
        onStartEdit,
        onInvalidFormula,
        onSave,
        onNoDataBoundary,
        dataService: externalDataService = null,
        getIsEditingFormula,
    }: Props = $props()

    // ========================================================================
    // Configuration (merge with defaults)
    // ========================================================================

    const defaultConfig: EngineConfig = {
        leftTopWidth: 32,
        leftTopHeight: 24,
        showHorizontalGridLines: true,
        showVerticalGridLines: true,
        defaultCellWidth: 6,
        defaultCellHeight: 25,
        scrollbarSize: 16,
    }

    const cfg = $derived({ ...defaultConfig, ...config })
    const LeftTop = $derived({ width: cfg.leftTopWidth, height: cfg.leftTopHeight })

    const CANVAS_ID = simpleUuid()

    // ========================================================================
    // State
    // ========================================================================

    let grid: Grid | null = $state(null)
    let sheets: readonly SheetInfo[] = $state([])
    let internalDataService: DataService | null = $state(null)
    // Sheets whose row/col header strip is stale because a SetColWidth /
    // SetRowHeight transaction targeted them while they weren't active.
    // Cleared as we render() that sheet (either immediately if it's the
    // active one, or when the user switches to it).
    const dirtyHeaderSheets = new Set<number>()
    // Per-sheet anchor memory. Switching to a sheet restores the anchor we
    // were at last time on that sheet; otherwise the new render reuses the
    // PREVIOUS sheet's anchor and paints one flash-frame at a viewport that
    // doesn't exist on the new sheet (the "wrong-page" flicker).
    const sheetAnchors = new Map<number, { x: number; y: number }>()
    // Use external data service if provided, otherwise use internal one
    let dataService: DataService | null = $derived(externalDataService ?? internalDataService)
    let canvasEl: HTMLCanvasElement | null = $state(null)
    let offscreenCanvas: OffscreenCanvas | null = null
    let anchorX = $state(0)
    let anchorY = $state(0)
    // Latest *requested* anchor. wheel/keyboard handlers chain deltas off
    // this instead of `anchorX/Y` (which only update when render resolves);
    // otherwise rapid input during in-flight renders loses or reverses
    // deltas.
    let pendingAnchorX = 0
    let pendingAnchorY = 0
    // Monotonic render ticket. Each render()/renderWithAnchor() takes the next
    // value; only the latest in-flight render may reconcile pendingAnchor on
    // resolve. Without this, an older (slower) render resolving after a newer
    // wheel already advanced pendingAnchor would clobber it, and the next
    // wheel would chain off a stale base — an occasional reverse jump, most
    // visible over heavy block-dense renders.
    let renderSeq = 0

    // Scrollbar state
    let documentHeight = $state(0)
    let documentWidth = $state(0)
    let visibleHeight = $state(0)
    let visibleWidth = $state(0)
    let scrollbarRendering = $state(false)

    // Selection state
    let selector: { x: number; y: number; width: number; height: number } | null = $state(null)
    // Fill-handle (autofill) state. `fillPreview` is the dashed rectangle
    // shown while dragging the handle; `fillSrc` remembers the source range
    // the drag started from.
    let fillPreview: { x: number; y: number; width: number; height: number } | null = $state(null)
    let fillSrc: { startRow: number; startCol: number; endRow: number; endCol: number } | null = null
    let fillDst: { startRow: number; startCol: number; endRow: number; endCol: number } | null = null
    let isFilling = false
    // Tooltip shown next to the cursor while dragging the fill handle,
    // displaying the value that lands in the cell at the drag edge.
    let fillTooltip: { x: number; y: number; text: string } | null = $state(null)
    // Memo of the last target range we requested a prediction for, so we
    // only hit the worker when the drag crosses into a new cell. A token
    // guards against stale async responses arriving out of order.
    let fillTipDstKey = ''
    let fillTipToken = 0
    let selectedRowRange: [number, number] | undefined = $state(undefined)
    let selectedColumnRange: [number, number] | undefined = $state(undefined)
    let startCell: { coordinate: { startRow: number; startCol: number; endRow: number; endCol: number } } | undefined
    let endCell: { coordinate: { startRow: number; startCol: number; endRow: number; endCol: number } } | undefined

    // Double-click detection
    let lastClickTime = 0
    let lastClickRow = -1
    let lastClickCol = -1

    // Cleanup references
    let resizeObserver: ResizeObserver | null = null
    let worker: Worker | null = null
    let prevDpr = 1
    // Track if we created the worker internally (need to clean up) vs using external data service
    let ownsWorker = false
    // Disposers for callbacks registered on the (possibly shared) data
    // service. Called on unmount so a torn-down view stops being notified.
    let subscriptions: Array<() => void> = []

    // ========================================================================
    // Lifecycle
    // ========================================================================

    onMount(() => {
        initializeAsync()
        return cleanup
    })

    async function initializeAsync() {
        // If external data service is provided, use it; otherwise create our own
        if (externalDataService) {
            // Using external data service from Engine - just initialize canvas
            if (canvasEl) {
                setCanvasSize()

                // Transfer control to offscreen
                if ('transferControlToOffscreen' in canvasEl) {
                    offscreenCanvas = canvasEl.transferControlToOffscreen()
                    await externalDataService.initOffscreen(offscreenCanvas, canvasId)
                    await render("init-external")
                }
            }

            // Register callbacks for external data service
            subscriptions.push(externalDataService.registerCellUpdatedCallback(async () => {
                const sheetList = externalDataService!.getCacheAllSheetInfo()
                sheets = sheetList
                onSheetsChange?.(sheetList)
                if (activeSheet > sheetList.length - 1) {
                    activeSheet = sheetList.length - 1
                    onActiveSheetChange?.(activeSheet)
                }
                await render("cellUpdated-external")
                updateDocumentDimensions()
            }))

            subscriptions.push(externalDataService.registerSheetUpdatedCallback(() => {
                const sheetList = externalDataService!.getCacheAllSheetInfo()
                sheets = sheetList
                onSheetsChange?.(sheetList)
            }))

            subscriptions.push(externalDataService.registerHeaderUpdatedCallback(
                (sheetIdxes) => onHeaderUpdated(sheetIdxes),
            ))

            // Load initial sheets list
            externalDataService.getWorkbook().getAllSheetInfo().then(v => {
                if (!isErrorMessage(v)) {
                    sheets = v
                    onSheetsChange?.(v)
                }
            })
        } else {
            // Create our own worker and data service
            ownsWorker = true
            worker = new MyWorker()
            internalDataService = new DataService(worker)

            // Initialize canvas
            if (canvasEl) {
                setCanvasSize()

                // Transfer control to offscreen
                if ('transferControlToOffscreen' in canvasEl) {
                    offscreenCanvas = canvasEl.transferControlToOffscreen()
                    await internalDataService.initOffscreen(offscreenCanvas, canvasId)
                    await render("init-internal")
                }
            }

            // Register callbacks
            internalDataService.registerCellUpdatedCallback(async () => {
                const sheetList = internalDataService!.getCacheAllSheetInfo()
                sheets = sheetList
                onSheetsChange?.(sheetList)
                if (activeSheet > sheetList.length - 1) {
                    activeSheet = sheetList.length - 1
                    onActiveSheetChange?.(activeSheet)
                }
                await render("cellUpdated-internal")
                updateDocumentDimensions()
            })

            // Also register sheet update callback
            internalDataService.registerSheetUpdatedCallback(() => {
                const sheetList = internalDataService!.getCacheAllSheetInfo()
                sheets = sheetList
                onSheetsChange?.(sheetList)
            })

            internalDataService.registerHeaderUpdatedCallback(
                (sheetIdxes) => onHeaderUpdated(sheetIdxes),
            )

            // Load initial sheets list
            internalDataService.getWorkbook().getAllSheetInfo().then(v => {
                if (!isErrorMessage(v)) {
                    sheets = v
                    onSheetsChange?.(v)
                }
            })
        }

        // Observe canvas size changes
        resizeObserver = new ResizeObserver(() => handleResize())
        if (canvasEl) {
            resizeObserver.observe(canvasEl)
        }

        // Watch for DPR changes (zoom, moving to different display)
        prevDpr = window.devicePixelRatio || 1
        window.addEventListener('resize', handleDprChange)
    }

    function cleanup() {
        resizeObserver?.disconnect()
        // Unregister callbacks so a shared (external) data service stops
        // notifying this torn-down view. (Internal services are gc'd with
        // their terminated worker, but disposing is harmless.)
        subscriptions.forEach((dispose) => dispose())
        subscriptions = []
        if (ownsWorker && worker) {
            // We created the worker internally — terminating it releases
            // everything, including its canvas.
            worker.terminate()
        } else if (externalDataService) {
            // Shared worker: release just this view's canvas so the
            // worker's canvas map doesn't leak across mount/unmount.
            externalDataService.disposeOffscreen(canvasId)
        }
        window.removeEventListener('resize', handleDprChange)
    }

    // ========================================================================
    // Canvas Setup
    // ========================================================================

    function handleDprChange() {
        const currentDpr = window.devicePixelRatio || 1
        if (Math.abs(currentDpr - prevDpr) > 1e-6) {
            prevDpr = currentDpr
            handleResize()
        }
    }

    function setCanvasSize() {
        if (!canvasEl) return null
        const size = canvasEl.getBoundingClientRect()
        canvasEl.width = size.width * (window.devicePixelRatio || 1)
        canvasEl.height = size.height * (window.devicePixelRatio || 1)
        visibleHeight = size.height
        visibleWidth = size.width
        return size
    }

    function handleResize() {
        if (!canvasEl || !dataService) return
        const rect = canvasEl.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        dataService.resize(rect.width, rect.height, dpr, canvasId)
        visibleHeight = rect.height
        visibleWidth = rect.width
    }

    async function updateDocumentDimensions() {
        if (!dataService) return
        const dimension = await dataService.getSheetDimension(activeSheet)
        if (!isErrorMessage(dimension)) {
            // Rust returns height in pt and width in Excel column-width
            // units. Convert to pixels so they share the same space as
            // anchorY / anchorX / visibleHeight / visibleWidth (all px).
            // The scrollbar component needs all three in the same unit.
            documentHeight = ptToPx(dimension.height)
            documentWidth = widthToPx(dimension.width)
        }
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    // Set window.__LS_RENDER_LOG__ = true in the console to trace which
    // call paths fire render with which anchor — flicker bugs usually
    // come from two near-simultaneous renders with diverging anchors.
    function logRender(tag: string, sheetId: number, ax: number, ay: number) {
        if (typeof window !== 'undefined' && (window as unknown as {__LS_RENDER_LOG__?: boolean}).__LS_RENDER_LOG__) {
            // eslint-disable-next-line no-console
            console.log(`[render:${tag}] sheet=${sheetId} anchor=(${ax.toFixed(1)},${ay.toFixed(1)})`)
        }
    }

    async function render(tag = 'render') {
        if (!dataService) return
        const sheetId = dataService.getSheetIdByIdx(activeSheet)
        // Use pendingAnchorX/Y, not anchorX/Y. anchorX/Y only updates
        // when the PREVIOUS render resolves, so a data-change-triggered
        // render() that fires while a scroll's renderWithAnchor() is
        // still in flight would otherwise use the pre-scroll anchor and
        // paint a one-frame "scroll snapback" before the proper anchor
        // lands.
        const ax = pendingAnchorX
        const ay = pendingAnchorY
        const seq = ++renderSeq
        logRender(tag, sheetId, ax, ay)
        const g = await dataService.render(sheetId, ax, ay, canvasId)
        if (isErrorMessage(g)) return
        grid = g
        anchorX = g.anchorX
        anchorY = g.anchorY
        // Only reconcile pending if no newer render has superseded this one
        // (see renderSeq).
        if (seq === renderSeq) {
            pendingAnchorX = g.anchorX
            pendingAnchorY = g.anchorY
        }
        onGridChange?.(grid)
        // The just-rendered sheet is now in sync — drop it from the
        // pending-header-refresh set if it was queued there.
        dirtyHeaderSheets.delete(activeSheet)
    }

    // Engine signal: the listed sheets had row-height / column-width
    // changes. If the active sheet is among them, refresh its layout now.
    // For the rest, queue them up — the next switch into one will render()
    // it and clear the entry.
    function onHeaderUpdated(sheetIdxes: readonly number[]) {
        for (const idx of sheetIdxes) {
            if (idx === activeSheet) {
                render("headerUpdated")
            } else {
                dirtyHeaderSheets.add(idx)
            }
        }
    }

    async function renderWithAnchor(newAnchorX: number, newAnchorY: number, tag = 'renderWithAnchor') {
        if (!dataService) return
        pendingAnchorX = newAnchorX
        pendingAnchorY = newAnchorY
        const seq = ++renderSeq
        const sheetId = dataService.getSheetIdByIdx(activeSheet)
        logRender(tag, sheetId, newAnchorX, newAnchorY)
        const g = await dataService.render(sheetId, newAnchorX, newAnchorY, canvasId)
        if (isErrorMessage(g)) return
        grid = g
        anchorX = g.anchorX
        anchorY = g.anchorY
        // Reconcile pending to the RESOLVED anchor, not the requested
        // one. `newAnchorX/Y` is often a rough estimate (e.g. scrollToCell
        // computes `row * rowHeightEstimate`); the engine snaps it to a
        // real row/col boundary and returns the actual anchor in
        // g.anchorX/Y. onWheel chains off pendingAnchorX/Y, so leaving
        // them at the estimate makes the first scroll after a jump snap
        // back toward the pre-resolved position. Matches render()'s
        // reconciliation.
        //
        // Only the latest in-flight render may reconcile — otherwise an
        // older render resolving after a newer wheel clobbers pendingAnchor
        // and the next wheel reverses (see renderSeq).
        if (seq === renderSeq) {
            pendingAnchorX = g.anchorX
            pendingAnchorY = g.anchorY
        }
        onGridChange?.(grid)
    }

    // ========================================================================
    // Selection
    // ========================================================================

    // Track previous selectedData to detect external changes
    let prevSelectedData: SelectedData | null = null

    // Use $effect for reactive updates in Svelte 5
    $effect(() => {
        updateSelector(selectedData, grid)
    })

    // Jump to selection when selectedData changes from external source
    $effect(() => {
        if (!dataService || !grid) return

        // Skip auto-jump while user is drag-selecting (they control the scroll)
        if (isDragging) return

        // Check if this is a new selection (not from internal mouse/keyboard)
        const sel = selectedData.data
        if (!sel || sel.ty !== 'cellRange') return

        // Compare with previous to detect external changes
        const prevSel = prevSelectedData?.data
        if (prevSel && prevSel.ty === 'cellRange') {
            const same = prevSel.d.startRow === sel.d.startRow &&
                        prevSel.d.startCol === sel.d.startCol &&
                        prevSel.d.endRow === sel.d.endRow &&
                        prevSel.d.endCol === sel.d.endCol
            if (same) return
        }
        prevSelectedData = selectedData

        // Check if selection is outside visible area
        const { startRow, startCol } = sel.d
        const firstCol = grid.columns[0]?.idx ?? 0
        const lastCol = grid.columns[grid.columns.length - 1]?.idx ?? firstCol
        const firstRow = grid.rows[0]?.idx ?? 0
        const lastRow = grid.rows[grid.rows.length - 1]?.idx ?? firstRow

        const needsJump = startRow < firstRow || startRow > lastRow ||
                         startCol < firstCol || startCol > lastCol

        if (needsJump) {
            // Calculate new anchor position to show the selected cell
            scrollToCell(startRow, startCol)
        }
    })

    async function scrollToCell(row: number, col: number) {
        if (!dataService) return

        // Estimate position - we need to calculate based on row/col
        // For now, use a simple approach: render at approximate position
        const rowHeightEstimate = 20  // Default row height in pixels
        const colWidthEstimate = 60   // Default col width in pixels

        // Only retarget the axis that's actually out of view. Recomputing
        // both axes unconditionally would drag the user's existing scroll
        // on the OTHER axis (e.g. a vertical-only jump-to-selection would
        // also reset anchorX to `col*colW - vw/4`, which the user reads
        // as "horizontal scroll drifts every time I tap a cell").
        const firstCol = grid?.columns[0]?.idx ?? 0
        const lastCol = grid?.columns[grid.columns.length - 1]?.idx ?? firstCol
        const firstRow = grid?.rows[0]?.idx ?? 0
        const lastRow = grid?.rows[grid.rows.length - 1]?.idx ?? firstRow

        const needsX = col < firstCol || col > lastCol
        const needsY = row < firstRow || row > lastRow

        const newAnchorX = needsX
            ? Math.max(0, col * colWidthEstimate - visibleWidth / 4)
            : pendingAnchorX
        const newAnchorY = needsY
            ? Math.max(0, row * rowHeightEstimate - visibleHeight / 4)
            : pendingAnchorY

        await renderWithAnchor(newAnchorX, newAnchorY)
    }

    function updateSelector(data: SelectedData, g: Grid | null) {
        if (!g) {
            selector = null
            return
        }

        const sel = data.data
        if (!sel) {
            selector = null
            return
        }

        const firstCol = g.columns[0]?.idx ?? 0
        const lastCol = g.columns[g.columns.length - 1]?.idx ?? firstCol
        const firstRow = g.rows[0]?.idx ?? 0
        const lastRow = g.rows[g.rows.length - 1]?.idx ?? firstRow

        if (sel.ty === 'cellRange') {
            const { startRow: row1, endRow: row2, startCol: col1, endCol: col2 } = sel.d
            const startCol = Math.min(col1, col2)
            const endCol = Math.max(col1, col2)
            const startRow = Math.min(row1, row2)
            const endRow = Math.max(row1, row2)

            const visStartCol = Math.max(startCol, firstCol)
            const visEndCol = Math.min(endCol, lastCol)
            const visStartRow = Math.max(startRow, firstRow)
            const visEndRow = Math.min(endRow, lastRow)

            if (visStartCol > visEndCol || visStartRow > visEndRow) {
                selector = null
                return
            }

            const startX = xForColStart(visStartCol, g)
            const endX = xForColEnd(visEndCol, g)
            const startY = yForRowStart(visStartRow, g)
            const endY = yForRowEnd(visEndRow, g)

            selector = {
                x: LeftTop.width + startX - 1,
                y: LeftTop.height + startY - 1,
                width: Math.max(0, endX - startX),
                height: Math.max(0, endY - startY),
            }
        } else if (sel.ty === 'line') {
            // Whole-row / whole-column selection. The box spans the selected
            // lines along one axis and the full visible grid along the other,
            // clamped to what's currently rendered (null if scrolled away).
            if (sel.d.type === 'row') {
                const visStartRow = Math.max(sel.d.start, firstRow)
                const visEndRow = Math.min(sel.d.end, lastRow)
                if (visStartRow > visEndRow) {
                    selector = null
                    return
                }
                const startY = yForRowStart(visStartRow, g)
                const endY = yForRowEnd(visEndRow, g)
                const startX = xForColStart(firstCol, g)
                const endX = xForColEnd(lastCol, g)
                selector = {
                    x: LeftTop.width + startX - 1,
                    y: LeftTop.height + startY - 1,
                    width: Math.max(0, endX - startX),
                    height: Math.max(0, endY - startY),
                }
            } else {
                const visStartCol = Math.max(sel.d.start, firstCol)
                const visEndCol = Math.min(sel.d.end, lastCol)
                if (visStartCol > visEndCol) {
                    selector = null
                    return
                }
                const startX = xForColStart(visStartCol, g)
                const endX = xForColEnd(visEndCol, g)
                const startY = yForRowStart(firstRow, g)
                const endY = yForRowEnd(lastRow, g)
                selector = {
                    x: LeftTop.width + startX - 1,
                    y: LeftTop.height + startY - 1,
                    width: Math.max(0, endX - startX),
                    height: Math.max(0, endY - startY),
                }
            }
        } else {
            selector = null
        }
    }

    // Pixel rectangle (canvas-relative, including the LeftTop header
    // offset) for a cell range, clamped to the visible grid. Returns null
    // when the range is fully scrolled out of view. Used for the fill
    // preview overlay.
    function pixelRectForRange(
        sr: number,
        sc: number,
        er: number,
        ec: number,
        g: Grid
    ): { x: number; y: number; width: number; height: number } | null {
        const firstCol = g.columns[0]?.idx ?? 0
        const lastCol = g.columns[g.columns.length - 1]?.idx ?? firstCol
        const firstRow = g.rows[0]?.idx ?? 0
        const lastRow = g.rows[g.rows.length - 1]?.idx ?? firstRow
        const vsc = Math.max(sc, firstCol)
        const vec = Math.min(ec, lastCol)
        const vsr = Math.max(sr, firstRow)
        const ver = Math.min(er, lastRow)
        if (vsc > vec || vsr > ver) return null
        const startX = xForColStart(vsc, g)
        const endX = xForColEnd(vec, g)
        const startY = yForRowStart(vsr, g)
        const endY = yForRowEnd(ver, g)
        return {
            x: LeftTop.width + startX - 1,
            y: LeftTop.height + startY - 1,
            width: Math.max(0, endX - startX),
            height: Math.max(0, endY - startY),
        }
    }

    $effect(() => {
        const rows = getSelectedRows(selectedData)
        if (rows.length > 0) {
            selectedRowRange = [Math.min(rows[0], rows[1]), Math.max(rows[0], rows[1])]
        } else {
            selectedRowRange = undefined
        }
        const cols = getSelectedColumns(selectedData)
        if (cols.length > 0) {
            selectedColumnRange = [Math.min(cols[0], cols[1]), Math.max(cols[0], cols[1])]
        } else {
            selectedColumnRange = undefined
        }
    })

    // ========================================================================
    // Event Handlers
    // ========================================================================

    async function onMouseDown(e: MouseEvent) {
        e.stopPropagation()
        e.preventDefault()

        if (e.button !== 0) return // Only left click
        if (!grid || !canvasEl) return

        // Don't steal focus from formula editor
        const isEditingFormula = getIsEditingFormula?.() ?? false
        if (!isEditingFormula) {
            canvasEl.focus({ preventScroll: true })
        }

        const rect = canvasEl.getBoundingClientRect()
        const matchedCell = match(
            e.clientX - rect.left,
            e.clientY - rect.top,
            anchorX,
            anchorY,
            grid
        )

        if (!matchedCell) return

        const { startRow: row, startCol: col } = matchedCell.coordinate

        // Double-click detection
        const now = Date.now()
        const isDoubleClick = (now - lastClickTime < 300) &&
                              (lastClickRow === row) &&
                              (lastClickCol === col)
        lastClickTime = now
        lastClickRow = row
        lastClickCol = col

        if (isDoubleClick && onStartEdit && dataService) {
            // Double-click to start editing with current content
            const sheetIdx = activeSheet
            const cellInfo = await dataService.getCellInfo(sheetIdx, row, col)
            let initialText = ''
            if (cellInfo && !isErrorMessage(cellInfo)) {
                if (cellInfo.getFormula() !== '') {
                    initialText = '=' + cellInfo.getFormula()
                } else {
                    initialText = cellInfo.getText()
                }
            }
            onStartEdit(row, col, initialText)
            return
        }

        startCell = matchedCell
        endCell = undefined
        isDragging = true

        const data = buildSelectedDataFromCell(row, col, 'none')
        selectedData = data
        onSelectedDataChange?.(data)

        const stopAutoScroll = () => {
            if (dragScrollInterval) {
                clearInterval(dragScrollInterval);
                dragScrollInterval = null;
            }
        };

        const startAutoScroll = (scrollX: number, scrollY: number) => {
            if (dragScrollInterval) return; // Already scrolling

            dragScrollInterval = setInterval(async () => {
                if (!canvasEl || !grid || !startCell || isScrolling) return;

                isScrolling = true;
                try {
                    let newAnchorX = anchorX;
                    let newAnchorY = anchorY;

                    if (scrollY > 0) {
                        newAnchorY = anchorY + AUTO_SCROLL_SPEED;
                    } else if (scrollY < 0) {
                        newAnchorY = Math.max(0, anchorY - AUTO_SCROLL_SPEED);
                    }

                    if (scrollX > 0) {
                        newAnchorX = anchorX + AUTO_SCROLL_SPEED;
                    } else if (scrollX < 0) {
                        newAnchorX = Math.max(0, anchorX - AUTO_SCROLL_SPEED);
                    }

                    if (newAnchorX !== anchorX || newAnchorY !== anchorY) {
                        // Wait for render to complete - after this, grid and anchorX/Y are in sync
                        await renderWithAnchor(newAnchorX, newAnchorY);

                        // Update selection with the now-consistent state
                        if (lastDragMouseEvent && grid && canvasEl && startCell) {
                            const r = canvasEl.getBoundingClientRect();
                            const cell = match(
                                lastDragMouseEvent.clientX - r.left,
                                lastDragMouseEvent.clientY - r.top,
                                anchorX,
                                anchorY,
                                grid
                            );
                            if (cell) {
                                endCell = cell;
                                const { startRow: sr, startCol: sc } = startCell.coordinate;
                                const { endRow: er, endCol: ec } = endCell.coordinate;
                                const d = buildSelectedDataFromCellRange(sr, sc, er, ec, 'none');
                                selectedData = d;
                                onSelectedDataChange?.(d);
                            }
                        }
                    }
                } finally {
                    isScrolling = false;
                }
            }, AUTO_SCROLL_INTERVAL);
        };

        const handleMouseMove = (mme: MouseEvent) => {
            if (!grid || !canvasEl) return;
            lastDragMouseEvent = mme;

            const r = canvasEl.getBoundingClientRect();
            const relX = mme.clientX - r.left;
            const relY = mme.clientY - r.top;

            // Check if mouse is in edge zone
            let scrollX = 0;
            let scrollY = 0;

            if (relY > r.height - AUTO_SCROLL_THRESHOLD) {
                scrollY = 1; // Scroll down
            } else if (relY < AUTO_SCROLL_THRESHOLD) {
                scrollY = -1; // Scroll up
            }

            if (relX > r.width - AUTO_SCROLL_THRESHOLD) {
                scrollX = 1; // Scroll right
            } else if (relX < AUTO_SCROLL_THRESHOLD) {
                scrollX = -1; // Scroll left
            }

            if (scrollX !== 0 || scrollY !== 0) {
                // In edge zone - start auto-scroll, don't update selection here
                startAutoScroll(scrollX, scrollY);
            } else {
                // Not in edge zone - stop auto-scroll, update selection normally
                stopAutoScroll();

                const cell = match(relX, relY, anchorX, anchorY, grid);
                if (!cell || !startCell) return;
                endCell = cell;
                const { startRow: sr, startCol: sc } = startCell.coordinate;
                const { endRow: er, endCol: ec } = endCell.coordinate;
                const d = buildSelectedDataFromCellRange(sr, sc, er, ec, 'none');
                selectedData = d;
                onSelectedDataChange?.(d);
            }
        };

        const handleMouseUp = () => {
            stopAutoScroll();
            isDragging = false;
            lastDragMouseEvent = null;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }

    // ------------------------------------------------------------------
    // Fill handle (autofill)
    // ------------------------------------------------------------------
    // Dragging the small square at the selection's bottom-right corner
    // extends the source range along one axis. The engine (Rust) decides
    // what each target cell receives (formula shift / arithmetic series /
    // value copy); we only supply geometry and commit one transaction.

    function normalizeRange(r: {
        startRow: number
        startCol: number
        endRow: number
        endCol: number
    }) {
        return {
            startRow: Math.min(r.startRow, r.endRow),
            endRow: Math.max(r.startRow, r.endRow),
            startCol: Math.min(r.startCol, r.endCol),
            endCol: Math.max(r.startCol, r.endCol),
        }
    }

    // Given the source block and the cell under the cursor, compute the
    // fill target range (along the dominant overflow axis). Returns null
    // when the cursor is still inside the source block.
    function computeFillDst(
        src: { startRow: number; startCol: number; endRow: number; endCol: number },
        pr: number,
        pc: number
    ): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
        const downOver = Math.max(0, pr - src.endRow)
        const upOver = Math.max(0, src.startRow - pr)
        const rightOver = Math.max(0, pc - src.endCol)
        const leftOver = Math.max(0, src.startCol - pc)
        const vert = Math.max(downOver, upOver)
        const horiz = Math.max(rightOver, leftOver)
        if (vert === 0 && horiz === 0) return null
        if (vert >= horiz) {
            if (downOver >= upOver)
                return { startRow: src.endRow + 1, endRow: pr, startCol: src.startCol, endCol: src.endCol }
            return { startRow: pr, endRow: src.startRow - 1, startCol: src.startCol, endCol: src.endCol }
        }
        if (rightOver >= leftOver)
            return { startRow: src.startRow, endRow: src.endRow, startCol: src.endCol + 1, endCol: pc }
        return { startRow: src.startRow, endRow: src.endRow, startCol: pc, endCol: src.startCol - 1 }
    }

    // Ask the engine to predict the fill and surface the value of the cell
    // at the drag edge (the far corner along the fill axis) in the tooltip.
    // Async + token-guarded so a slow worker reply can't overwrite a newer
    // drag position.
    async function updateFillTooltip(
        src: { startRow: number; startCol: number; endRow: number; endCol: number },
        dst: { startRow: number; startCol: number; endRow: number; endCol: number },
        tipX: number,
        tipY: number
    ) {
        if (!dataService) return
        const token = ++fillTipToken
        const inputs = await dataService.predictFill(activeSheet, src, dst)
        // Stale (drag moved on or ended) — discard.
        if (token !== fillTipToken || !isFilling) return
        if (isErrorMessage(inputs) || inputs.length === 0) {
            fillTooltip = null
            return
        }
        // The "edge" cell: far row/col along whichever axis the fill grew.
        const vertical = dst.startCol === src.startCol && dst.endCol === src.endCol
        const edgeRow = vertical
            ? dst.startRow < src.startRow
                ? dst.startRow
                : dst.endRow
            : src.startRow
        const edgeCol = vertical
            ? src.startCol
            : dst.startCol < src.startCol
              ? dst.startCol
              : dst.endCol
        const edge =
            inputs.find((i) => i.row === edgeRow && i.col === edgeCol) ??
            inputs[inputs.length - 1]
        const text = edge.content
        if (text === '') {
            fillTooltip = null
            return
        }
        fillTooltip = { x: tipX, y: tipY, text }
    }

    function onFillHandleMouseDown(e: MouseEvent) {
        e.stopPropagation()
        e.preventDefault()
        if (e.button !== 0 || !grid || !canvasEl) return

        const range = getSelectedCellRange(selectedData)
        if (!range) return
        fillSrc = normalizeRange(range)
        fillDst = null
        isFilling = true

        const handleMove = (mme: MouseEvent) => {
            if (!grid || !canvasEl || !fillSrc) return
            const r = canvasEl.getBoundingClientRect()
            const relX = mme.clientX - r.left
            const relY = mme.clientY - r.top
            const cell = match(relX, relY, anchorX, anchorY, grid)
            if (!cell) return
            const { startRow: pr, startCol: pc } = cell.coordinate
            const dst = computeFillDst(fillSrc, pr, pc)
            fillDst = dst
            if (!dst) {
                fillPreview = null
                fillTooltip = null
                fillTipDstKey = ''
                return
            }
            // Preview spans the union of source and target.
            const u = {
                startRow: Math.min(fillSrc.startRow, dst.startRow),
                startCol: Math.min(fillSrc.startCol, dst.startCol),
                endRow: Math.max(fillSrc.endRow, dst.endRow),
                endCol: Math.max(fillSrc.endCol, dst.endCol),
            }
            fillPreview = pixelRectForRange(u.startRow, u.startCol, u.endRow, u.endCol, grid)

            // Position the tooltip just below-right of the cursor.
            const tipX = LeftTop.width + relX + 14
            const tipY = LeftTop.height + relY + 18
            if (fillTooltip) {
                fillTooltip = { ...fillTooltip, x: tipX, y: tipY }
            }
            // Only re-query when the drag enters a new target range.
            const key = `${dst.startRow},${dst.startCol},${dst.endRow},${dst.endCol}`
            if (key !== fillTipDstKey) {
                fillTipDstKey = key
                updateFillTooltip(fillSrc, dst, tipX, tipY)
            }
        }

        const handleUp = async () => {
            window.removeEventListener('mousemove', handleMove)
            window.removeEventListener('mouseup', handleUp)
            isFilling = false
            fillPreview = null
            fillTooltip = null
            fillTipDstKey = ''
            fillTipToken++
            const src = fillSrc
            const dst = fillDst
            fillSrc = null
            fillDst = null
            if (!src || !dst || !dataService) return

            const result = await dataService.fill(activeSheet, src, dst)
            if (isErrorMessage(result)) {
                console.warn('fill failed:', result.msg)
                return
            }
            // Select the whole filled block (source + target).
            const u = buildSelectedDataFromCellRange(
                Math.min(src.startRow, dst.startRow),
                Math.min(src.startCol, dst.startCol),
                Math.max(src.endRow, dst.endRow),
                Math.max(src.endCol, dst.endCol),
                'none'
            )
            selectedData = u
            onSelectedDataChange?.(u)
        }

        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleUp)
    }

    function handleCanvasContextMenu(e: MouseEvent) {
        e.preventDefault()
        e.stopPropagation()

        // Nothing to do if the host isn't listening for the menu trigger.
        if (!onContextMenu) return

        if (!grid || !canvasEl) return

        const rect = canvasEl.getBoundingClientRect()
        const matchedCell = match(
            e.clientX - rect.left,
            e.clientY - rect.top,
            anchorX,
            anchorY,
            grid
        )

        // If clicking on a cell that's not in current selection, select it first
        if (matchedCell) {
            const { startRow: row, startCol: col } = matchedCell.coordinate
            const currentRange = selectedData.data

            // Check if clicked cell is within current selection
            let inSelection = false
            if (currentRange?.ty === 'cellRange') {
                const { startRow, startCol, endRow, endCol } = currentRange.d
                const minRow = Math.min(startRow, endRow)
                const maxRow = Math.max(startRow, endRow)
                const minCol = Math.min(startCol, endCol)
                const maxCol = Math.max(startCol, endCol)
                inSelection = row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
            }

            if (!inSelection) {
                // Select the clicked cell
                const data = buildSelectedDataFromCell(row, col, 'none')
                selectedData = data
                onSelectedDataChange?.(data)
            }

            onContextMenu(
                { selectedData, target: 'cell', row, col, event: e },
                e.clientX,
                e.clientY,
            )
        } else {
            onContextMenu(
                { selectedData, target: 'cell', event: e },
                e.clientX,
                e.clientY,
            )
        }
    }

    function onColumnContextMenu(col: number, e: MouseEvent) {
        if (!onContextMenu) return
        onContextMenu(
            { selectedData, target: 'column', col, event: e },
            e.clientX,
            e.clientY,
        )
    }

    function onRowContextMenu(row: number, e: MouseEvent) {
        if (!onContextMenu) return
        onContextMenu(
            { selectedData, target: 'row', row, event: e },
            e.clientX,
            e.clientY,
        )
    }

    // ========================================================================
    // Resize Handlers
    // ========================================================================

    function onResizeCol(colIdx: number, deltaPx: number) {
        if (!grid || !dataService) return
        const col = grid.columns.find((c) => c.idx === colIdx)
        if (!col) return
        const newWidthPx = Math.max(10, col.width + deltaPx) // Minimum 10px width
        const sheetIdx = activeSheet
        dataService.handleTransaction({
            payloads: [
                {
                    type: 'setColWidth',
                    value: { sheetIdx, col: colIdx, width: pxToWidth(newWidthPx) },
                },
            ],
            undoable: true,
            temp: false,
        })
    }

    function onResizeRow(rowIdx: number, deltaPx: number) {
        if (!grid || !dataService) return
        const row = grid.rows.find((r) => r.idx === rowIdx)
        if (!row) return
        const newHeightPx = Math.max(10, row.height + deltaPx) // Minimum 10px height
        const sheetIdx = activeSheet
        dataService.handleTransaction({
            payloads: [
                {
                    type: 'setRowHeight',
                    value: { sheetIdx, row: rowIdx, height: pxToPt(newHeightPx) },
                },
            ],
            undoable: true,
            temp: false,
        })
    }

    function onWheel(e: WheelEvent) {
        e.preventDefault()

        if (e.deltaY === 0) return

        // Chain off pendingAnchorY, not the rendered anchorY — otherwise
        // wheel events arriving during an in-flight render compute from a
        // stale base and lose (or reverse) deltas.
        const newY = Math.max(0, pendingAnchorY + e.deltaY)
        if (newY === pendingAnchorY) return

        renderWithAnchor(pendingAnchorX, newY)
    }

    // Every keyboard action is registered in ./shortcuts.ts and wired to a
    // handler here. `onKeyDown` is a pure dispatcher; the handlers below close
    // over component state to do the actual work. The only binding that can't
    // be a fixed key — "type any printable char to start editing" — stays as a
    // fallback at the bottom of onKeyDown.
    //
    // Remaining chord handlers (copy/cut/paste/selectAll/bold/italic/underline/
    // fillDown/fillRight/find/formatCells/insertDate/insertTime/autoSum/
    // toggleFormulas) are intentionally omitted — an absent entry falls through
    // and preserves native/default behavior. Add one when the feature lands.
    const shortcutHandlers: ShortcutHandlers = {
        moveUp: () => moveSelection('up'),
        moveDown: () => moveSelection('down'),
        moveLeft: () => moveSelection('left'),
        moveRight: () => moveSelection('right'),
        enter: (e) => moveSelection(e.shiftKey ? 'up' : 'down'),
        tab: (e) => moveSelection(e.shiftKey ? 'left' : 'right'),
        editCell: () => editCurrentCell(),
        clearCell: () => startEditCurrent(''),
        jumpUp: () => jumpToBoundary('up'),
        jumpDown: () => jumpToBoundary('down'),
        jumpLeft: () => jumpToBoundary('left'),
        jumpRight: () => jumpToBoundary('right'),
        bold: () => toggleFontStyle('bold'),
        italic: () => toggleFontStyle('italic'),
        underline: () => toggleFontStyle('underline'),
        insertDate: () => insertDateTime('date'),
        insertTime: () => insertDateTime('time'),
        undo: () => dataService?.undo(),
        redo: () => dataService?.redo(),
        // Persisting is the host's call (file export, server sync, ...); the
        // grid just forwards the intent.
        save: () => onSave?.(),
    }

    /** Begin editing the selected cell, seeding the editor with `initial`. */
    function startEditCurrent(initial: string) {
        if (!onStartEdit) return
        const sel = getSelectedCellRange(selectedData)
        if (!sel) return
        onStartEdit(sel.startRow, sel.startCol, initial)
    }

    /**
     * Ctrl/⌘+B / I / U: toggle a font style over the current selection.
     * The toggle direction is decided from the anchor cell's current style, so
     * the whole selection follows the anchor (matching Excel/Sheets). A cell
     * range emits per-cell `cellStyleUpdate`; a whole row/col selection emits a
     * single `lineStyleUpdate` so styling a full line stays one payload.
     */
    async function toggleFontStyle(kind: 'bold' | 'italic' | 'underline') {
        if (!dataService) return

        const range = getSelectedCellRange(selectedData)
        const lines = range ? undefined : getSelectedLines(selectedData)
        if (!range && !lines) return

        // Anchor cell whose current style decides the toggle direction.
        const anchorRow = range ? range.startRow : lines!.type === 'row' ? lines!.start : 0
        const anchorCol = range ? range.startCol : lines!.type === 'col' ? lines!.start : 0
        const anchor = await dataService.getCellInfo(activeSheet, anchorRow, anchorCol)
        if (!anchor || isErrorMessage(anchor)) return
        const font = anchor.getStyle().font

        let ty: StyleUpdateType
        if (kind === 'bold') ty = { setFontBold: !font.bold }
        else if (kind === 'italic') ty = { setFontItalic: !font.italic }
        else {
            const on = !!font.underline && font.underline.val !== 'none'
            ty = { setFontUnderline: on ? 'none' : 'single' }
        }

        const payloads: EditPayload[] = []
        if (range) {
            for (let r = range.startRow; r <= range.endRow; r++) {
                for (let c = range.startCol; c <= range.endCol; c++) {
                    payloads.push({
                        type: 'cellStyleUpdate',
                        value: { sheetIdx: activeSheet, row: r, col: c, ty },
                    })
                }
            }
        } else {
            payloads.push({
                type: 'lineStyleUpdate',
                value: {
                    sheetIdx: activeSheet,
                    from: lines!.start,
                    to: lines!.end,
                    ty,
                    row: lines!.type === 'row',
                },
            })
        }
        await dataService.handleTransaction({ payloads, undoable: true, temp: false })
    }

    /**
     * Ctrl/⌘+; (date) and Ctrl/⌘+Shift+; (time): stamp the current date/time
     * into the active cell. Uses DATE()/TIME() with today's parts (the same
     * form the block date-picker writes), so the value is a real serial the
     * engine understands rather than a plain string.
     */
    async function insertDateTime(kind: 'date' | 'time') {
        if (!dataService) return
        const range = getSelectedCellRange(selectedData)
        if (!range) return
        const now = new Date()
        const content =
            kind === 'date'
                ? `=DATE(${now.getFullYear()}, ${now.getMonth() + 1}, ${now.getDate()})`
                : `=TIME(${now.getHours()}, ${now.getMinutes()}, ${now.getSeconds()})`
        const payloads: EditPayload[] = [
            {
                type: 'cellInput',
                value: {
                    sheetIdx: activeSheet,
                    row: range.startRow,
                    col: range.startCol,
                    content,
                },
            },
        ]
        await dataService.handleTransaction({ payloads, undoable: true, temp: false })
    }

    /** Ctrl/⌘+Arrow: jump the selection to the next data/block boundary. */
    async function jumpToBoundary(direction: 'up' | 'down' | 'left' | 'right') {
        if (!dataService) return
        const sel = getSelectedCellRange(selectedData)
        if (!sel) return
        const target = await dataService.getWorkbook().getDataBoundary({
            sheetIdx: activeSheet,
            rowIdx: sel.startRow,
            colIdx: sel.startCol,
            direction,
        })
        // No boundary ahead — engine returns an ErrorMessage; leave the
        // selection put and let the host surface a hint.
        if (isErrorMessage(target)) {
            onNoDataBoundary?.(direction)
            return
        }
        await goToCell(target.y, target.x)
    }

    /** F2: open the editor pre-filled with the cell's current text/formula. */
    async function editCurrentCell() {
        if (!dataService || !onStartEdit) return
        const sel = getSelectedCellRange(selectedData)
        if (!sel) return
        const {startRow: row, startCol: col} = sel
        const cellInfo = await dataService.getCellInfo(activeSheet, row, col)
        let initialText = ''
        if (cellInfo && !isErrorMessage(cellInfo)) {
            initialText =
                cellInfo.getFormula() !== ''
                    ? '=' + cellInfo.getFormula()
                    : cellInfo.getText()
        }
        onStartEdit(row, col, initialText)
    }

    async function onKeyDown(e: KeyboardEvent) {
        // 1) Registered key bindings (navigation, edit, Ctrl/⌘ chords).
        if (dispatchShortcut(e, shortcutHandlers)) {
            e.preventDefault()
            e.stopPropagation()
            return
        }
        // 2) Unhandled modifier combos: leave them to the browser/host.
        if (e.metaKey || e.altKey || e.ctrlKey) return
        if (!grid || !dataService || !canvasEl) return
        // 3) Fallback: a printable character starts editing the selected cell.
        if (e.key.length === 1 && onStartEdit) {
            const sel = getSelectedCellRange(selectedData)
            if (!sel) return
            e.preventDefault()
            e.stopPropagation()
            onStartEdit(sel.startRow, sel.startCol, e.key)
        }
    }

    async function moveSelection(direction: 'up' | 'down' | 'left' | 'right') {
        if (!grid || !dataService || !canvasEl) return

        const selectedCells = getSelectedCellRange(selectedData)
        if (!selectedCells) return

        const row = selectedCells.startRow
        const col = selectedCells.startCol
        const size = canvasEl.getBoundingClientRect()
        const workbook = dataService.getWorkbook()
        const sheetIdx = activeSheet

        switch (direction) {
            case 'up': {
                if (row === 0) return
                // Check if previous row is visible
                const [startIdx, _endIdx] = findVisibleRowIdxRange(anchorY, size.height - 50, grid)
                const idx = grid.rows.findIndex((v) => v.idx === row)
                if (idx >= 0 && idx - 1 >= startIdx) {
                    // Cell above is visible, just select it
                    const newData = buildSelectedDataFromCellRange(
                        grid.rows[idx - 1].idx, col, grid.rows[idx - 1].idx, col, 'none'
                    )
                    selectedData = newData
                    onSelectedDataChange?.(newData)
                    return
                }
                // Need to scroll - get position of cell above
                const nextCell = await workbook.getNextVisibleCell({ sheetIdx, rowIdx: row, colIdx: col, direction: 'up' })
                if (isErrorMessage(nextCell)) return
                const cellPos = await workbook.getCellPosition({ sheetIdx, row: nextCell.y, col: nextCell.x })
                if (isErrorMessage(cellPos)) return
                await renderWithAnchor(anchorX, ptToPx(cellPos.y))
                const newData = buildSelectedDataFromCellRange(nextCell.y, col, nextCell.y, col, 'none')
                selectedData = newData
                onSelectedDataChange?.(newData)
                return
            }
            case 'down': {
                // Check if next row is visible
                const [_startIdx, endIdx] = findVisibleRowIdxRange(anchorY, size.height - 50, grid)
                const idx = grid.rows.findIndex((v) => v.idx === row)
                if (idx >= 0 && idx + 1 <= endIdx) {
                    // Cell below is visible, just select it
                    const newData = buildSelectedDataFromCellRange(
                        grid.rows[idx + 1].idx, col, grid.rows[idx + 1].idx, col, 'none'
                    )
                    selectedData = newData
                    onSelectedDataChange?.(newData)
                    return
                }
                // Need to scroll - get position of cell below
                const nextCell = await workbook.getNextVisibleCell({ sheetIdx, rowIdx: row, colIdx: col, direction: 'down' })
                if (isErrorMessage(nextCell)) return
                const cellPos = await workbook.getCellPosition({ sheetIdx, row: nextCell.y, col: nextCell.x })
                if (isErrorMessage(cellPos)) return
                await renderWithAnchor(anchorX, ptToPx(cellPos.y) - size.height + 50)
                const newData = buildSelectedDataFromCellRange(nextCell.y, col, nextCell.y, col, 'none')
                selectedData = newData
                onSelectedDataChange?.(newData)
                return
            }
            case 'left': {
                if (col === 0) return
                // Check if previous col is visible
                const [startIdx, _endIdx] = findVisibleColIdxRange(anchorX, size.width, grid)
                const idx = grid.columns.findIndex((v) => v.idx === col)
                if (idx > 0 && idx - 1 >= startIdx) {
                    // Cell to left is visible, just select it
                    const newData = buildSelectedDataFromCellRange(
                        row, grid.columns[idx - 1].idx, row, grid.columns[idx - 1].idx, 'none'
                    )
                    selectedData = newData
                    onSelectedDataChange?.(newData)
                    return
                }
                // Need to scroll - get position of cell to left
                const nextCell = await workbook.getNextVisibleCell({ sheetIdx, rowIdx: row, colIdx: col, direction: 'left' })
                if (isErrorMessage(nextCell)) return
                const cellPos = await workbook.getCellPosition({ sheetIdx, row: nextCell.y, col: nextCell.x })
                if (isErrorMessage(cellPos)) return
                await renderWithAnchor(ptToPx(cellPos.x), anchorY)
                const newData = buildSelectedDataFromCellRange(row, nextCell.x, row, nextCell.x, 'none')
                selectedData = newData
                onSelectedDataChange?.(newData)
                return
            }
            case 'right': {
                // Check if next col is visible
                const [_startIdx, endIdx] = findVisibleColIdxRange(anchorX, size.width, grid)
                const idx = grid.columns.findIndex((v) => v.idx === col)
                if (idx >= 0 && idx + 1 <= endIdx) {
                    // Cell to right is visible, just select it
                    const newData = buildSelectedDataFromCellRange(
                        row, grid.columns[idx + 1].idx, row, grid.columns[idx + 1].idx, 'none'
                    )
                    selectedData = newData
                    onSelectedDataChange?.(newData)
                    return
                }
                // Need to scroll - get position of cell to right
                const nextCell = await workbook.getNextVisibleCell({ sheetIdx, rowIdx: row, colIdx: col, direction: 'right' })
                if (isErrorMessage(nextCell)) return
                const cellPos = await workbook.getCellPosition({ sheetIdx, row: nextCell.y, col: nextCell.x })
                if (isErrorMessage(cellPos)) return
                await renderWithAnchor(ptToPx(cellPos.x) - size.width + 100, anchorY)
                const newData = buildSelectedDataFromCellRange(row, nextCell.x, row, nextCell.x, 'none')
                selectedData = newData
                onSelectedDataChange?.(newData)
                return
            }
        }
    }

    // ========================================================================
    // Public API
    // ========================================================================

    // Returns true when the workbook was loaded, false when it was not — either
    // the beforeLoad gate vetoed it (user declined the overwrite) or the load
    // failed. Callers use this to skip post-load bookkeeping on a no-op.
    export async function loadWorkbook(
        data: Uint8Array,
        name: string
    ): Promise<boolean> {
        if (!dataService) return false
        const res = await dataService.loadWorkbook(data, name)
        if (isErrorMessage(res)) return false
        await render("loadWorkbook")
        await updateDocumentDimensions()
        return true
    }

    export function setActiveSheet(idx: number) {
        if (!dataService) return
        // Remember the anchor we're leaving so coming back to this sheet
        // lands where the user left off rather than at the new sheet's
        // anchor.
        sheetAnchors.set(activeSheet, { x: anchorX, y: anchorY })
        activeSheet = idx
        const restored = sheetAnchors.get(idx)
        anchorX = restored?.x ?? 0
        anchorY = restored?.y ?? 0
        pendingAnchorX = anchorX
        pendingAnchorY = anchorY
        render("setActiveSheet")
    }

    export function getDataService(): DataService | null {
        return dataService
    }

    /** Scroll to make a specific cell visible */
    export async function goToCell(row: number, col: number) {
        await scrollToCell(row, col)
        // Also select the cell
        const data = buildSelectedDataFromCellRange(row, col, row, col, 'none')
        selectedData = data
        onSelectedDataChange?.(data)
    }

    /**
     * External writer for the `selectedData` prop. The host (`engine.setSelection`)
     * uses this so the canvas-side selector and the auto-scroll `$effect` see
     * the new value — without it the prop is only the initial mount value and
     * external selection changes silently miss the visual layer.
     */
    export function setSelectedData(data: SelectedData) {
        selectedData = data
    }

    /** Select a cell or range and scroll to it */
    export async function selectRange(startRow: number, startCol: number, endRow: number, endCol: number) {
        const data = buildSelectedDataFromCellRange(startRow, startCol, endRow, endCol, 'none')
        selectedData = data
        onSelectedDataChange?.(data)
        await scrollToCell(startRow, startCol)
    }
</script>

<div class="spreadsheet-container">
    <div class="canvas-area" class:with-tabs={showSheetTabs}>
        <div class="canvas-wrapper">
            <!-- Corner cell -->
            <div
                class="corner-cell"
                style="width: {LeftTop.width}px; height: {LeftTop.height}px;"
            ></div>

            <!-- Column headers -->
            <ColumnHeaders
                {grid}
                {selectedColumnRange}
                leftTopWidth={LeftTop.width}
                leftTopHeight={LeftTop.height}
                onSelectColumn={(col) => {
                    const data = buildSelectedDataFromLines(col, col, 'col', 'none')
                    selectedData = data
                    onSelectedDataChange?.(data)
                }}
                onSelectColumnRange={(startCol, endCol) => {
                    const data = buildSelectedDataFromLines(startCol, endCol, 'col', 'none')
                    selectedData = data
                    onSelectedDataChange?.(data)
                }}
                onContextMenu={onColumnContextMenu}
                {onResizeCol}
            />

            <!-- Row headers -->
            <RowHeaders
                {grid}
                {selectedRowRange}
                leftTopWidth={LeftTop.width}
                leftTopHeight={LeftTop.height}
                onSelectRow={(row) => {
                    const data = buildSelectedDataFromLines(row, row, 'row', 'none')
                    selectedData = data
                    onSelectedDataChange?.(data)
                }}
                onSelectRowRange={(startRow, endRow) => {
                    const data = buildSelectedDataFromLines(startRow, endRow, 'row', 'none')
                    selectedData = data
                    onSelectedDataChange?.(data)
                }}
                onContextMenu={onRowContextMenu}
                {onResizeRow}
            />

            <!-- Main canvas -->
            <canvas
                bind:this={canvasEl}
                id={CANVAS_ID}
                tabindex="0"
                class="main-canvas"
                style="left: {LeftTop.width}px; top: {LeftTop.height}px; width: calc(100% - {LeftTop.width}px - {showScrollbars ? cfg.scrollbarSize : 0}px); height: calc(100% - {LeftTop.height}px - {showScrollbars ? cfg.scrollbarSize : 0}px);"
                onmousedown={onMouseDown}
                oncontextmenu={handleCanvasContextMenu}
                onwheel={onWheel}
                onkeydown={onKeyDown}
            >
                Your browser does not support canvas.
            </canvas>

            <!-- Selection indicator -->
            {#if selector}
                <Selector {...selector} />
                <!-- Fill handle: small square at the selection's bottom-right corner -->
                <div
                    class="fill-handle"
                    style="left: {selector.x + selector.width - 3}px; top: {selector.y + selector.height - 3}px;"
                    onmousedown={onFillHandleMouseDown}
                    role="presentation"
                ></div>
            {/if}

            <!-- Fill drag preview -->
            {#if fillPreview}
                <div
                    class="fill-preview"
                    style="left: {fillPreview.x}px; top: {fillPreview.y}px; width: {fillPreview.width}px; height: {fillPreview.height}px;"
                ></div>
            {/if}

            <!-- Fill drag tooltip (value at the drag edge) -->
            {#if fillTooltip}
                <div
                    class="fill-tooltip"
                    style="left: {fillTooltip.x}px; top: {fillTooltip.y}px;"
                >
                    {fillTooltip.text}
                </div>
            {/if}

            <!-- Scrollbars -->
            {#if showScrollbars}
                <div class="scrollbar-y" style="width: {cfg.scrollbarSize}px; top: {LeftTop.height}px; bottom: {cfg.scrollbarSize}px;">
                    <Scrollbar
                        orientation="y"
                        totalLength={documentHeight}
                        position={anchorY}
                        visibleLength={visibleHeight}
                        onChange={(pos) => {
                            scrollbarRendering = true
                            renderWithAnchor(anchorX, pos)
                        }}
                        onBlur={() => { scrollbarRendering = false }}
                    />
                </div>
                <div class="scrollbar-x" style="height: {cfg.scrollbarSize}px; left: {LeftTop.width}px; right: {cfg.scrollbarSize}px;">
                    <Scrollbar
                        orientation="x"
                        totalLength={documentWidth}
                        position={anchorX}
                        visibleLength={visibleWidth}
                        onChange={(pos) => {
                            scrollbarRendering = true
                            renderWithAnchor(pos, anchorY)
                        }}
                        onBlur={() => { scrollbarRendering = false }}
                    />
                </div>
            {/if}
        </div>
    </div>

    <!-- Sheet tabs -->
    {#if showSheetTabs}
        <SheetTabs
            {sheets}
            {activeSheet}
            onActiveSheetChange={(idx) => {
                // Same flicker-avoidance as setActiveSheet — see comment
                // on sheetAnchors.
                sheetAnchors.set(activeSheet, { x: anchorX, y: anchorY })
                activeSheet = idx
                onActiveSheetChange?.(idx)
                const restored = sheetAnchors.get(idx)
                anchorX = restored?.x ?? 0
                anchorY = restored?.y ?? 0
                pendingAnchorX = anchorX
                pendingAnchorY = anchorY
                render("sheetTabs")
                updateDocumentDimensions()
            }}
            onTransaction={async (tx) => {
                if (!dataService) return true
                const result = await dataService.handleTransaction(tx)
                if (result) {
                    // error
                    onInvalidFormula?.()
                    return true
                }
                return false // success
            }}
        />
    {/if}
</div>

<style>
    .spreadsheet-container {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .canvas-area {
        flex: 1;
        position: relative;
        overflow: hidden;
    }

    .canvas-area.with-tabs {
        /* Sheet tabs have their own height in flex layout */
        min-height: 0;
    }

    .canvas-wrapper {
        width: 100%;
        height: 100%;
        position: relative;
    }

    .corner-cell {
        position: absolute;
        left: 0;
        top: 0;
        background: #f5f5f5;
        border-right: 1px solid #e0e0e0;
        border-bottom: 1px solid #e0e0e0;
        pointer-events: none;
        z-index: 2;
    }

    .main-canvas {
        position: absolute;
        display: block;
        z-index: 0;
        outline: none;
    }

    .fill-handle {
        position: absolute;
        width: 7px;
        height: 7px;
        box-sizing: border-box;
        background: #1a73e8;
        border: 1px solid #fff;
        cursor: crosshair;
        z-index: 11;
    }

    .fill-preview {
        position: absolute;
        pointer-events: none;
        box-sizing: border-box;
        border: 1px dashed #1a73e8;
        background: rgba(26, 115, 232, 0.04);
        z-index: 9;
    }

    .fill-tooltip {
        position: absolute;
        pointer-events: none;
        z-index: 12;
        max-width: 240px;
        padding: 2px 6px;
        font-size: 12px;
        line-height: 16px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #fff;
        background: #3c4043;
        border-radius: 3px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    .scrollbar-y {
        position: absolute;
        right: 0;
        bottom: 16px;
    }

    .scrollbar-x {
        position: absolute;
        bottom: 0;
        right: 16px;
    }
</style>
