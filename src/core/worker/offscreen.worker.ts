import {Pool} from '@/core/pool'
import {
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

        const result: Grid = {
            anchorX: viewResponse.anchorX,
            anchorY: viewResponse.anchorY,
            rows: rows,
            columns: columns,
            blockInfos: viewResponse.data.blocks,
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
