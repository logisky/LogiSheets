import {inject} from 'inversify'
import {TYPES} from '../ioc/types'
import {WorkbookClient, OffscreenClient} from './clients'
import {Grid} from '../worker/types'
import {
    isErrorMessage,
    SheetInfo,
    Callback,
    Transaction,
    Resp,
    SheetDimension,
    Cell,
    MergeCell,
    BlockInfo,
} from 'logisheets-web'

export const MAX_COUNT = 10000

export class DataServiceImpl {
    constructor(
        @inject(TYPES.Workbook) private _workbook: WorkbookClient,
        @inject(TYPES.Offscreen) private _offscreen: OffscreenClient
    ) {
        this._init()
    }

    public render(
        sheetId: number,
        anchorX: number,
        anchorY: number
    ): Resp<Grid> {
        return this._offscreen.render(sheetId, anchorX, anchorY).then((v) => {
            if (isErrorMessage(v)) return v
            this._grid = v
            if (!this._render) return v
            this._render(v)
            return v
        })
    }

    public resize(width: number, height: number, dpr: number): Resp<Grid> {
        return this._offscreen.resize(width, height, dpr).then((v) => {
            if (isErrorMessage(v)) return v
            this._grid = v
            if (!this._render) return v
            this._render(v)
            return v
        })
    }

    public async loadWorkbook(buf: Uint8Array, name: string): Resp<void> {
        await this._workbook.loadWorkbook({content: buf, name})
        this._sheetIdx = 0
        return this._offscreen.render(this._sheetId, 0, 0).then((v) => {
            if (isErrorMessage(v)) return
            this._grid = v
            if (!this._render) return
            this._render(v)
            this._anchorX = 0
            this._anchorY = 0
        })
    }

    public getFullyCoveredBlocks(
        sheetIdx: number,
        row: number,
        col: number,
        height: number,
        width: number
    ): Resp<readonly BlockInfo[]> {
        return this._workbook.getFullyCoveredBlocks({
            sheetIdx,
            row,
            col,
            height,
            width,
        })
    }

    public setCurrentSheetIdx(idx: number): void {
        if (idx >= this._sheetInfos.length) return
        this._sheetIdx = idx
        this._sheetId = this._sheetInfos[idx].id
        this._offscreen.render(this._sheetId, 0, 0).then((v) => {
            if (isErrorMessage(v)) return
            this._grid = v
            if (!this._render) return
            this._render(v)
            this._anchorX = 0
            this._anchorY = 0
        })
    }

    public getWorkbook(): WorkbookClient {
        return this._workbook
    }

    public getAvailableBlockId(sheetIdx: number): Resp<number> {
        return this._workbook.getAvailableBlockId({sheetIdx})
    }

    public getCurrentSheetIdx(): number {
        return this._sheetIdx
    }

    public getCurrentSheetId(): number {
        return this._sheetId
    }

    public getCurrentSheetName(): string {
        return this._sheetInfos[this._sheetIdx].name
    }

    public handleTransaction(transaction: Transaction): Resp<void> {
        return this._workbook.handleTransaction({transaction})
    }

    public getSheetDimension(sheetIdx: number): Resp<SheetDimension> {
        return this._workbook.getSheetDimension(sheetIdx)
    }

    public getMergedCells(
        sheetIdx: number,
        targetStartRow: number,
        targetStartCol: number,
        targetEndRow: number,
        targetEndCol: number
    ): Resp<readonly MergeCell[]> {
        return this._workbook.getMergedCells({
            startRow: targetStartRow,
            endRow: targetEndRow,
            startCol: targetStartCol,
            endCol: targetEndCol,
            sheetIdx,
        })
    }

    public undo(): Resp<void> {
        return this._workbook.undo()
    }

    public redo(): Resp<void> {
        return this._workbook.redo()
    }

    public getGrid(): Grid | undefined {
        return this._grid
    }

    public getCellInfo(sheetIdx: number, row: number, col: number): Resp<Cell> {
        return this._workbook.getCell({sheetIdx, row, col}).then((v) => {
            if (!isErrorMessage(v)) return new Cell(v)
            return v
        })
    }

    public registerRenderCallback(f: (grid: Grid) => void): void {
        if (this._render) {
            return
        }
        this._render = f
        this._workbook.registerCellUpdatedCallback(async () => {
            const grid = await this._offscreen.render(
                this._sheetId,
                this._anchorX,
                this._anchorY
            )
            if (isErrorMessage(grid)) return
            this._grid = grid

            if (!this._render) return
            this._render(grid)
        })
    }

    public getCacheAllSheetInfo(): readonly SheetInfo[] {
        return this._sheetInfos
    }

    public registerSheetUpdatedCallback(f: () => void): void {
        this._sheetUpdateCallback.push(f)
    }

    public initOffscreen(canvas: OffscreenCanvas): Resp<void> {
        return this._offscreen.init(canvas, window.devicePixelRatio)
    }

    public registerCellUpdatedCallback(
        f: () => void,
        callbackId?: number
    ): void {
        return this._workbook.registerCellUpdatedCallback(f, callbackId)
    }

    private _init() {
        this._workbook.getAllSheetInfo().then((v) => {
            if (!isErrorMessage(v)) this._sheetInfos = v
        })
        this._workbook.registerSheetUpdatedCallback(() => {
            this._workbook.getAllSheetInfo().then((v) => {
                if (!isErrorMessage(v)) this._sheetInfos = v
                this._sheetUpdateCallback.forEach((f) => f())
            })
        })
    }

    private _sheetInfos: readonly SheetInfo[] = []

    private _sheetIdx = 0
    private _sheetId = 0
    private _anchorX = 0
    private _anchorY = 0
    private _sheetUpdateCallback: Callback[] = []
    private _grid?: Grid

    private _render?: (grid: Grid) => void
}
