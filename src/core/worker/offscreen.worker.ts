import {Pool} from '@/core/pool'
import {
    AppropriateHeight,
    Grid,
    IOffscreenWorker,
    IWorkbookWorker,
    OffscreenRenderName,
} from './types'
import {isErrorMessage, Result} from 'logisheets-web'
import {ViewManager} from './view_manager'
import {Painter} from './painter'

const pool = new Pool()

export class OffscreenWorkerImpl implements IOffscreenWorker {
    constructor(
        private readonly _workbook: IWorkbookWorker,
        private readonly _ctx: Worker
    ) {}

    resize(width: number, height: number, dpr: number): Result<Grid> {
        if (!this._canvas) throw Error('canvas is not ready')

        this._canvas.width = width * dpr
        this._canvas.height = height * dpr
        this._dpr = dpr
        window.devicePixelRatio = dpr

        return this.render(this._sheetId, this._anchorX, this._anchorY)
    }

    init(canvas: OffscreenCanvas, dpr: number) {
        this._canvas = canvas
        this._dpr = dpr
        window.devicePixelRatio = dpr
    }

    getAppropriateHeights(
        sheetId: number,
        anchorX: number,
        anchorY: number
    ): Result<AppropriateHeight[]> {
        if (!this._canvas) {
            throw new Error('Canvas not initialized')
        }
        this._sheetId = sheetId

        const ctx = this._canvas.getContext('2d')
        if (!ctx) {
            throw new Error('Failed to get 2D context')
        }

        const sheetIdx = this._workbook.getSheetIdx({sheetId})
        if (isErrorMessage(sheetIdx)) return sheetIdx

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(this._dpr, this._dpr)

        const viewManager = new ViewManager(this._workbook, sheetIdx, pool)

        const viewResponse = viewManager.getViewResponse(
            anchorX,
            anchorY,
            this._canvas.height,
            this._canvas.width
        )
        if (isErrorMessage(viewResponse)) return viewResponse

        this._anchorX = viewResponse.anchorX
        this._anchorY = viewResponse.anchorY
        this._painter.setCanvas(this._canvas)
        return this._painter.getAppropriateHeights(
            viewResponse.data,
            anchorX,
            anchorY
        )
    }

    render(sheetId: number, anchorX: number, anchorY: number): Result<Grid> {
        if (!this._canvas) {
            throw new Error('Canvas not initialized')
        }
        this._sheetId = sheetId

        const ctx = this._canvas.getContext('2d')
        if (!ctx) {
            throw new Error('Failed to get 2D context')
        }

        const sheetIdx = this._workbook.getSheetIdx({sheetId})
        if (isErrorMessage(sheetIdx)) return sheetIdx

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(this._dpr, this._dpr)
        ctx.clearRect(
            0,
            0,
            this._canvas.width * this._dpr,
            this._canvas.height * this._dpr
        )

        const viewManager = new ViewManager(this._workbook, sheetIdx, pool)

        const viewResponse = viewManager.getViewResponse(
            anchorX,
            anchorY,
            this._canvas.height,
            this._canvas.width
        )
        if (isErrorMessage(viewResponse)) return viewResponse
        console.log('viewResponse', viewResponse)

        this._anchorX = viewResponse.anchorX
        this._anchorY = viewResponse.anchorY
        this._painter.setCanvas(this._canvas)
        this._painter.render(
            viewResponse.data,
            viewResponse.anchorX,
            viewResponse.anchorY
        )

        const rows = viewResponse.data.rows
            .filter((r) => r.position.startRow >= viewResponse.anchorY)
            .map((r) => {
                return {
                    idx: r.coordinate.startRow,
                    height: r.position.height,
                }
            })
        const columns = viewResponse.data.cols
            .filter((c) => c.position.startCol >= viewResponse.anchorX)
            .map((c) => {
                return {
                    idx: c.coordinate.startCol,
                    width: c.position.width,
                }
            })
        const mergeCells = viewResponse.data.mergeCells.map((m) => {
            return {
                startRow: m.coordinate.startRow,
                startCol: m.coordinate.startCol,
                endRow: m.coordinate.endRow,
                endCol: m.coordinate.endCol,
            }
        })

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
            rows: rows,
            columns: columns,
            mergeCells: mergeCells,
            blockInfos: viewResponse.data.blocks,
            preRowHeight,
            preColWidth,
            nextRowHeight,
            nextColWidth,
        }

        pool.releaseCellView(viewResponse.data)

        return result
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public handleRequest(request: {m: string; args: any; rid: number}) {
        const {m, args, rid: id} = request

        if (!this._canvas && m != OffscreenRenderName.Init) {
            this._ctx.postMessage({
                error: 'OffsreenWorkerImpl not initialized',
                rid: id,
            })
            return
        }

        let result
        switch (m) {
            case OffscreenRenderName.Render:
                result = this.render(args.sheetId, args.anchorX, args.anchorY)
                break
            case OffscreenRenderName.Resize:
                result = this.resize(args.width, args.height, args.dpr)
                break
            case OffscreenRenderName.Init:
                result = this.init(args.canvas, args.dpr)
                break
            case OffscreenRenderName.GetAppropriateHeights:
                result = this.getAppropriateHeights(
                    args.sheetId,
                    args.anchorX,
                    args.anchorY
                )
                break
            default:
                this._ctx.postMessage({
                    error: 'Unknown method',
                    rid: id,
                })
                return
        }

        this._ctx.postMessage({result, rid: id})
    }

    private _canvas: OffscreenCanvas | undefined
    private _dpr: number = 1
    private _painter: Painter = new Painter()

    private _sheetId: number = 0
    private _anchorX: number = 0
    private _anchorY: number = 0
}
