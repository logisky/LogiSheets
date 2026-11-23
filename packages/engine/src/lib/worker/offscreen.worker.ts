/**
 * Offscreen worker service - handles rendering operations in a Web Worker.
 */

import {isErrorMessage} from 'logisheets-web'
import type {CellImageInfo} from 'logisheets-web'
import type {ColFitWidth, Grid, RowFitHeight} from '$types/index'
import type {IWorkbookWorker, Result} from './types'
import {OffscreenRenderName} from './types'
import {ViewManager} from './view_manager'
import type {CellView} from './view_manager'
import {Painter, setShowCellValues, setShowFormulas} from './painter'
import {Pool} from './pool'
import {setGridVisibility} from './border_helper'
import {
    getZoomFactor,
    ptToPx,
    pxToPt,
    pxToWidth,
    setZoomFactor,
    widthToPx,
} from './standable'

const pool = new Pool()

/** Excel's default row height; a fitted row is never shorter. */
const DEFAULT_ROW_PT = 15

/** Decode a standard base64 string to bytes (workers provide `atob`). */
function base64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64)
    const len = bin.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
}

/** Per-canvas rendering state. One entry per on-screen view. */
interface CanvasState {
    canvas: OffscreenCanvas
    dpr: number
    sheetId: number
    anchorX: number
    anchorY: number
}

export class OffscreenWorkerService {
    constructor(
        private readonly _workbook: IWorkbookWorker,
        private readonly _ctx: Worker
    ) {}

    // One canvas per view, keyed by canvasId. The painter has no retained
    // per-canvas state (it's re-pointed via setCanvas on every render), so a
    // single shared instance serves all canvases.
    private _canvases: Map<number, CanvasState> = new Map()
    private _painter: Painter = new Painter()
    // Scratch surface for getRowFitHeights: measuring must not touch a view.
    private _measureCanvas: OffscreenCanvas | null = null

    // Decoded cell images, keyed by their stable image id. Decoding is async
    // (createImageBitmap), so the first render that needs an image schedules the
    // decode and re-renders the canvas once it resolves.
    private _imageBitmaps: Map<string, ImageBitmap> = new Map()
    private _pendingImages: Set<string> = new Set()

    private _getCanvas(canvasId: number): CanvasState {
        const state = this._canvases.get(canvasId)
        if (!state) {
            throw new Error(`Canvas ${canvasId} not initialized`)
        }
        return state
    }

    // ========================================================================
    // Public API
    // ========================================================================

    public init(canvasId: number, canvas: OffscreenCanvas, dpr: number): void {
        this._canvases.set(canvasId, {
            canvas,
            dpr,
            sheetId: 0,
            anchorX: 0,
            anchorY: 0,
        })
        ;(self as any).window.devicePixelRatio = dpr
    }

    /** Release a canvas when its view unmounts. No-op if already gone. */
    public dispose(canvasId: number): void {
        this._canvases.delete(canvasId)
    }

    /**
     * Show/hide the default cell gridlines. Module-level in border_helper, so
     * one call affects every canvas this worker renders. Callers re-render.
     */
    public setGridLines(horizontal: boolean, vertical: boolean): void {
        setGridVisibility(horizontal, vertical)
    }

    /**
     * Worker-global zoom (effective-DPI multiplier on the unit↔px converters).
     * Module-level in standable, so one call affects every canvas this worker
     * lays out and paints. Callers re-render.
     */
    public setZoom(zoom: number): void {
        setZoomFactor(zoom)
    }

    /**
     * Show/hide cell VALUES (text). Module-level in painter, so one call affects
     * every canvas this worker renders. Fills/borders/gridlines are untouched.
     * Callers re-render.
     */
    public setShowCellValues(show: boolean): void {
        setShowCellValues(show)
    }

    /** Show formulas instead of results (worker-global). Callers re-render. */
    public setShowFormulas(show: boolean): void {
        setShowFormulas(show)
    }

    public resize(
        canvasId: number,
        width: number,
        height: number,
        dpr: number
    ): Result<Grid> {
        const state = this._getCanvas(canvasId)

        state.canvas.width = width * dpr
        state.canvas.height = height * dpr
        state.dpr = dpr
        ;(self as any).window.devicePixelRatio = dpr

        return this.render(
            canvasId,
            state.sheetId,
            state.anchorX,
            state.anchorY
        )
    }

    public render(
        canvasId: number,
        sheetId: number,
        anchorX: number,
        anchorY: number
    ): Result<Grid> {
        const state = this._getCanvas(canvasId)
        const canvas = state.canvas
        const dpr = state.dpr
        // Recorded BEFORE the id is validated below: a render for a deleted
        // sheet sticks, and later resize/image-ready re-renders of this
        // canvas keep failing until a render with a live id.
        state.sheetId = sheetId
        ;(self as any).window.devicePixelRatio = dpr

        const ctx = canvas.getContext('2d')
        if (!ctx) {
            throw new Error('Failed to get 2D context')
        }

        const sheetIdx = this._workbook.getSheetIdx({sheetId})
        if (isErrorMessage(sheetIdx)) return sheetIdx

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)
        // After scale, clearRect uses CSS pixel coordinates
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

        const viewManager = new ViewManager(this._workbook, sheetIdx, pool)

        // Pass CSS pixel dimensions - all position values are in CSS pixels
        const viewResponse = viewManager.getViewResponse(
            anchorX,
            anchorY,
            canvas.height / dpr,
            canvas.width / dpr
        )
        if (isErrorMessage(viewResponse)) return viewResponse

        state.anchorX = viewResponse.anchorX
        state.anchorY = viewResponse.anchorY
        this._painter.setCanvas(canvas)
        this._painter.render(
            viewResponse.data,
            viewResponse.anchorX,
            viewResponse.anchorY
        )

        // Draw cell images on top of the grid. Uses viewResponse.data (released to
        // the pool below), so must run before that release.
        this._renderCellImages(
            canvasId,
            sheetId,
            viewResponse.data,
            viewResponse.anchorX,
            viewResponse.anchorY
        )

        // Include all visible rows/columns (including partially visible ones)
        // A row/column is visible if its end position extends beyond the anchor
        const visibleRows = viewResponse.data.rows.filter(
            (r) => r.position.endRow > viewResponse.anchorY
        )
        const visibleCols = viewResponse.data.cols.filter(
            (c) => c.position.endCol > viewResponse.anchorX
        )
        const rows = visibleRows.map((r) => ({
            idx: r.coordinate.startRow,
            height: r.position.height,
        }))
        const columns = visibleCols.map((c) => ({
            idx: c.coordinate.startCol,
            width: c.position.width,
        }))
        // Sub-row/col offset: pixels by which the first visible row/col is
        // scrolled past the canvas top/left. Overlay helpers subtract this so
        // their results stay in canvas-pixel space.
        const subOffsetY =
            visibleRows.length > 0
                ? viewResponse.anchorY - visibleRows[0].position.startRow
                : 0
        const subOffsetX =
            visibleCols.length > 0
                ? viewResponse.anchorX - visibleCols[0].position.startCol
                : 0
        const mergeCells = viewResponse.data.mergeCells.map((m) => ({
            startRow: m.coordinate.startRow,
            startCol: m.coordinate.startCol,
            endRow: m.coordinate.endRow,
            endCol: m.coordinate.endCol,
        }))

        const hyperlinks = viewResponse.data.cells
            .filter((c) => c.info?.isHyperlink)
            .map((c) => ({
                row: c.coordinate.startRow,
                col: c.coordinate.startCol,
            }))

        const getRowHeight = (rowIdx: number): number | undefined => {
            const r = this._workbook
                .getWorkbook()
                .getWorksheetById(sheetId)
                .getRowHeight(rowIdx)
            if (isErrorMessage(r)) {
                return undefined
            }
            return r
        }

        const getColWidth = (colIdx: number): number | undefined => {
            const c = this._workbook
                .getWorkbook()
                .getWorksheetById(sheetId)
                .getColWidth(colIdx)
            if (isErrorMessage(c)) {
                return undefined
            }
            return c
        }

        const preRow = rows[0].idx > 1 ? rows[0].idx - 1 : undefined
        let preRowHeight = undefined
        if (preRow !== undefined) {
            preRowHeight = getRowHeight(preRow)
        }
        const nextRow = rows[rows.length - 1].idx + 1
        const nextRowHeight = getRowHeight(nextRow)
        const preCol = columns[0].idx > 1 ? columns[0].idx - 1 : undefined
        let preColWidth = undefined
        if (preCol !== undefined) {
            preColWidth = getColWidth(preCol)
        }
        const nextCol = columns[columns.length - 1].idx + 1
        const nextColWidth = getColWidth(nextCol)

        const result: Grid = {
            anchorX: viewResponse.anchorX,
            anchorY: viewResponse.anchorY,
            subOffsetX,
            subOffsetY,
            rows,
            columns,
            mergeCells,
            hyperlinks,
            blockInfos: viewResponse.data.blocks,
            preRowHeight,
            preColWidth,
            nextRowHeight,
            nextColWidth,
        }

        pool.releaseCellView(viewResponse.data)

        return result
    }

    /**
     * Draw the sheet's cell images that fall within the current view. Images
     * whose bitmap isn't decoded yet are scheduled for async decode; the canvas
     * re-renders once they're ready.
     */
    private _renderCellImages(
        canvasId: number,
        sheetId: number,
        data: CellView,
        anchorX: number,
        anchorY: number
    ): void {
        const ws = this._workbook.getWorkbook().getWorksheetById(sheetId)
        const images = ws.getCellImages()
        if (isErrorMessage(images) || images.length === 0) return

        // Pixel spans of the visible rows/columns, keyed by row/col index.
        const rowSpan = new Map<number, {start: number; end: number}>()
        data.rows.forEach((r) =>
            rowSpan.set(r.coordinate.startRow, {
                start: r.position.startRow,
                end: r.position.endRow,
            })
        )
        const colSpan = new Map<number, {start: number; end: number}>()
        data.cols.forEach((c) =>
            colSpan.set(c.coordinate.startCol, {
                start: c.position.startCol,
                end: c.position.endCol,
            })
        )

        images.forEach((img: CellImageInfo) => {
            const rs = rowSpan.get(img.row)
            const cs = colSpan.get(img.col)
            if (!rs || !cs) return // not in the visible window
            const bitmap = this._imageBitmaps.get(img.id)
            if (bitmap) {
                this._painter.renderImage(
                    bitmap,
                    cs.start - anchorX,
                    rs.start - anchorY,
                    cs.end - cs.start,
                    rs.end - rs.start
                )
            } else {
                this._loadImageBitmap(img, canvasId)
            }
        })
    }

    /** Decode an image to an `ImageBitmap` and re-render its canvas when ready. */
    private _loadImageBitmap(img: CellImageInfo, canvasId: number): void {
        if (this._pendingImages.has(img.id)) return
        this._pendingImages.add(img.id)
        let bytes: Uint8Array
        try {
            bytes = base64ToBytes(img.data)
        } catch {
            this._pendingImages.delete(img.id)
            return
        }
        const blob = new Blob([bytes as unknown as BlobPart], {
            type: `image/${img.format}`,
        })
        createImageBitmap(blob)
            .then((bitmap) => {
                this._imageBitmaps.set(img.id, bitmap)
                this._pendingImages.delete(img.id)
                // Redraw the canvas now that the bitmap is available. The returned
                // Grid is discarded — the visible effect is the canvas repaint.
                const state = this._canvases.get(canvasId)
                if (state) {
                    this.render(
                        canvasId,
                        state.sheetId,
                        state.anchorX,
                        state.anchorY
                    )
                }
            })
            .catch(() => {
                this._pendingImages.delete(img.id)
            })
    }

    /**
     * Heights (pt) rows `fromRow..=toRow` of sheet `sheetIdx` need to show
     * their content, on screen or not, measured the way the painter lays
     * text out. Only rows that would change are returned. Rows the user
     * sized by hand (`customHeight`), hidden rows and rows with no text are
     * left out, and a fit never goes below Excel's 15pt default.
     *
     * Measures at 100%: the painter's fonts do not scale with the zoom but
     * cell widths do, so a zoomed measurement would wrap differently.
     */
    /**
     * Measure rows `fromRow..=toRow` against every used column and return
     * the height each row's content needs, for the rows that need a change.
     * By default this is the follow-up to an edit, so rows the user sized by
     * hand and rows with no text are left alone. `force` is the user asking
     * (double-clicking a row border): every visible row is fitted, and an
     * empty one goes back to the default height.
     */
    public getRowFitHeights(
        sheetIdx: number,
        fromRow: number,
        toRow: number,
        force = false
    ): Result<RowFitHeight[]> {
        const dim = this._workbook.getSheetDimension(sheetIdx)
        if (isErrorMessage(dim)) return dim
        return this._measure(
            sheetIdx,
            {fromRow, toRow, fromCol: 0, toCol: Math.max(0, dim.maxCol)},
            (view) => {
                const content = this._painter.measureRowContent(
                    view.data,
                    0,
                    view.anchorY
                )
                const fits: RowFitHeight[] = []
                view.data.data.forEach((chunk) =>
                    chunk.rowMeta.forEach((meta, row) => {
                        if (row < fromRow || row > toRow || meta.hidden) return
                        if (meta.customHeight && !force) return
                        const px = content.get(row)
                        if (px === undefined && !force) return
                        const height = Math.max(
                            DEFAULT_ROW_PT,
                            px === undefined ? 0 : pxToPt(px)
                        )
                        // A forced fit of a hand-sized row must land even at
                        // the same height: it clears the custom flag.
                        if (
                            Math.abs(height - meta.height) < 0.5 &&
                            !(force && meta.customHeight)
                        )
                            return
                        fits.push({row, height})
                    })
                )
                return fits
            }
        )
    }

    /**
     * Measure columns `fromCol..=toCol` against every used row and return the
     * width (column-width units) each one's widest single-line text needs.
     * Columns with no text, and hidden ones, are left out — Excel leaves an
     * empty column's width alone too.
     */
    public getColFitWidths(
        sheetIdx: number,
        fromCol: number,
        toCol: number
    ): Result<ColFitWidth[]> {
        const dim = this._workbook.getSheetDimension(sheetIdx)
        if (isErrorMessage(dim)) return dim
        return this._measure(
            sheetIdx,
            {fromRow: 0, toRow: Math.max(0, dim.maxRow), fromCol, toCol},
            (view) => {
                const hidden = new Set<number>()
                view.data.data.forEach((chunk) =>
                    chunk.colMeta.forEach(
                        (m, col) => m.hidden && hidden.add(col)
                    )
                )
                const fits: ColFitWidth[] = []
                this._painter
                    .measureColContent(view.data)
                    .forEach((px, col) => {
                        if (col < fromCol || col > toCol || hidden.has(col))
                            return
                        fits.push({col, width: pxToWidth(px)})
                    })
                return fits
            }
        )
    }

    /**
     * Lay out the cells `rows × cols` of `sheetIdx` at zoom 1 on the scratch
     * canvas — as if a canvas that size were scrolled there — and hand the
     * result to `measure`. Fits are stored in zoom-independent units, so the
     * view's zoom must not leak into them.
     */
    private _measure<T>(
        sheetIdx: number,
        range: {fromRow: number; toRow: number; fromCol: number; toCol: number},
        measure: (view: {data: CellView; anchorY: number}) => T
    ): Result<T> {
        const zoom = getZoomFactor()
        setZoomFactor(1)
        try {
            const top = this._workbook.getCellPosition({
                sheetIdx,
                row: range.fromRow,
                col: range.fromCol,
            })
            if (isErrorMessage(top)) return top
            const bottom = this._workbook.getCellPosition({
                sheetIdx,
                row: range.toRow + 1,
                col: range.toCol + 1,
            })
            if (isErrorMessage(bottom)) return bottom
            const anchorX = widthToPx(top.x)
            const anchorY = ptToPx(top.y)
            const view = new ViewManager(
                this._workbook,
                sheetIdx,
                pool
            ).getViewResponse(
                anchorX,
                anchorY,
                ptToPx(bottom.y - top.y),
                widthToPx(bottom.x - top.x)
            )
            if (isErrorMessage(view)) return view
            this._measureCanvas ??= new OffscreenCanvas(1, 1)
            this._painter.setCanvas(this._measureCanvas)
            return measure({data: view.data, anchorY})
        } finally {
            setZoomFactor(zoom)
        }
    }

    // ========================================================================
    // Request Handler
    // ========================================================================

    public handleRequest(request: {m: string; args: any; rid: number}): void {
        const {m, args, rid: id} = request

        // canvasId defaults to 0 so single-canvas callers that don't pass one
        // still work (backwards compatible).
        const canvasId: number = args?.canvasId ?? 0

        if (
            m !== OffscreenRenderName.Init &&
            m !== OffscreenRenderName.Dispose &&
            m !== OffscreenRenderName.SetGridLines &&
            m !== OffscreenRenderName.SetZoom &&
            m !== OffscreenRenderName.SetShowCellValues &&
            m !== OffscreenRenderName.SetShowFormulas &&
            m !== OffscreenRenderName.GetRowFitHeights &&
            m !== OffscreenRenderName.GetColFitWidths &&
            !this._canvases.has(canvasId)
        ) {
            this._ctx.postMessage({
                error: `OffscreenWorkerService canvas ${canvasId} not initialized`,
                rid: id,
            })
            return
        }

        let result
        try {
            switch (m) {
                case OffscreenRenderName.Render:
                    result = this.render(
                        canvasId,
                        args.sheetId,
                        args.anchorX,
                        args.anchorY
                    )
                    break
                case OffscreenRenderName.Resize:
                    result = this.resize(
                        canvasId,
                        args.width,
                        args.height,
                        args.dpr
                    )
                    break
                case OffscreenRenderName.Init:
                    result = this.init(canvasId, args.canvas, args.dpr)
                    break
                case OffscreenRenderName.Dispose:
                    result = this.dispose(canvasId)
                    break
                case OffscreenRenderName.GetRowFitHeights:
                    result = this.getRowFitHeights(
                        args.sheetIdx,
                        args.fromRow,
                        args.toRow,
                        args.force
                    )
                    break
                case OffscreenRenderName.GetColFitWidths:
                    result = this.getColFitWidths(
                        args.sheetIdx,
                        args.fromCol,
                        args.toCol
                    )
                    break
                case OffscreenRenderName.SetGridLines:
                    result = this.setGridLines(args.horizontal, args.vertical)
                    break
                case OffscreenRenderName.SetZoom:
                    result = this.setZoom(args.zoom)
                    break
                case OffscreenRenderName.SetShowCellValues:
                    result = this.setShowCellValues(args.show)
                    break
                case OffscreenRenderName.SetShowFormulas:
                    result = this.setShowFormulas(args.show)
                    break
                default:
                    this._ctx.postMessage({
                        error: 'Unknown method',
                        rid: id,
                    })
                    return
            }
        } catch (error) {
            this._ctx.postMessage({
                error: String(error),
                rid: id,
            })
            return
        }

        this._ctx.postMessage({result, rid: id})
    }
}
