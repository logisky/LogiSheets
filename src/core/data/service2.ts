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
    CellPosition,
    CellId,
} from 'logisheets-web'
import {sheetCellIdToString} from './clients/workbook'

export const MAX_COUNT = 10000
type SheetId = number

export class DataServiceImpl {
    constructor(
        @inject(TYPES.Workbook) private _workbook: WorkbookClient,
        @inject(TYPES.Offscreen) private _offscreen: OffscreenClient
    ) {
        this._init()
    }

    public async render(
        sheetId: number,
        anchorX: number,
        anchorY: number
    ): Resp<Grid> {
        return this._offscreen.render(sheetId, anchorX, anchorY).then((v) => {
            if (isErrorMessage(v)) return v
            return v
        })
    }

    public async resize(
        width: number,
        height: number,
        dpr: number
    ): Resp<Grid> {
        return this._offscreen.resize(width, height, dpr).then((v) => {
            if (isErrorMessage(v)) return v
            return v
        })
    }

    public async loadWorkbook(buf: Uint8Array, name: string): Resp<void> {
        await this._workbook.loadWorkbook({content: buf, name})
        this._sheetIdx = 0
        return this._offscreen.render(this._sheetId, 0, 0).then((v) => {
            if (isErrorMessage(v)) return
            0
            0
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

    public getCellInfo(sheetIdx: number, row: number, col: number): Resp<Cell> {
        return this._workbook.getCell({sheetIdx, row, col}).then((v) => {
            if (!isErrorMessage(v)) return new Cell(v)
            return v
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

    public addInvalidCell(
        sheetId: SheetId,
        cellId: CellId,
        startPosition: CellPosition,
        endPosition: CellPosition
    ) {
        if (!this._invalidCellMap.has(sheetId)) {
            this._invalidCellMap.set(sheetId, new Map())
        }
        this._invalidCellMap
            .get(sheetId)
            ?.set(sheetCellIdToString({sheetId, cellId}), [
                startPosition,
                endPosition,
            ])
    }

    public removeInvalidCell(sheetId: SheetId, cellId: CellId) {
        this._invalidCellMap
            .get(sheetId)
            ?.delete(sheetCellIdToString({sheetId, cellId}))
    }

    public getInvalidCells(): readonly [CellPosition, CellPosition][] {
        return Array.from(
            this._invalidCellMap
                .get(this._sheetId)
                ?.values()
                .map((v) => {
                    return v
                }) ?? []
        )
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
    private _sheetUpdateCallback: Callback[] = []

    private _invalidCellMap = new Map<
        SheetId,
        Map<string, [CellPosition, CellPosition]>
    >()
}
