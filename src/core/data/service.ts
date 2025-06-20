import {inject, injectable} from 'inversify'
import {getID} from '../ioc/id'
import {TYPES} from '../ioc/types'
import {
    CustomFunc,
    Transaction,
    SheetInfo,
    Cell,
    BlockInfo,
    SheetDimension,
    MergeCell,
    Resp,
} from 'logisheets-web'
import {CellViewResponse, ViewManager} from './view_manager'
import {WorkbookClient} from './workbook'
import {Pool} from '../pool'

export const MAX_COUNT = 100000000
export const CANVAS_OFFSET = 100

export interface DataService {
    registryCustomFunc(f: CustomFunc): Resp<void>
    registryCellUpdatedCallback(f: () => void): void
    registrySheetUpdatedCallback(f: () => void): void
    handleTransaction(t: Transaction): Resp<void>
    undo(): Resp<void>
    redo(): Resp<void>

    loadWorkbook(buf: Uint8Array, name: string): Resp<void>

    getCellView(
        sheetIdx: number,
        startX: number,
        startY: number,
        height: number,
        width: number
    ): Resp<CellViewResponse>

    getCellViewWithCell(
        sheetIdx: number,
        row: number,
        col: number,
        height: number,
        width: number
    ): Resp<CellViewResponse>

    getFullyCoveredBlocks(
        sheetIdx: number,
        startRow: number,
        startCol: number,
        endRow: number,
        endCol: number
    ): Resp<readonly BlockInfo[]>

    getSheetDimension(sheetIdx: number): Resp<SheetDimension>

    hasCellView(): boolean

    getCurrentSheetIdx(): number
    setCurrentSheetIdx(idx: number): void

    getMergedCells(
        sheetIdx: number,
        targetStartRow: number,
        targetStartCol: number,
        targetEndRow: number,
        targetEndCol: number
    ): Resp<readonly MergeCell[]>

    getAllSheetInfo(): Resp<readonly SheetInfo[]>
    getCellInfo(sheetIdx: number, row: number, col: number): Resp<Cell>
    getAvailableBlockId(sheetIdx: number): Resp<number>
    getSheetId(sheetIdx: number): Resp<number>
}

@injectable()
export class DataServiceImpl implements DataService {
    readonly id = getID()
    constructor(
        @inject(TYPES.Workbook) private _workbook: WorkbookClient,
        @inject(TYPES.Pool) private _pool: Pool
    ) {
        this._init()
    }
    getSheetId(sheetIdx: number): Resp<number> {
        return this._workbook.getSheetId({sheetIdx})
    }

    getAvailableBlockId(sheetIdx: number): Resp<number> {
        return this._workbook.getAvailableBlockId({sheetIdx})
    }

    getMergedCells(
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
    hasCellView(): boolean {
        return this._cellViews.has(this.getCurrentSheetIdx())
    }

    public getSheetDimension(sheetIdx: number): Resp<SheetDimension> {
        return this._workbook.getSheetDimension(sheetIdx)
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

    public getCellInfo(sheetIdx: number, row: number, col: number): Resp<Cell> {
        return this._workbook.getCell({sheetIdx, row, col})
    }

    public registrySheetUpdatedCallback(f: () => void): void {
        return this._workbook.registrySheetUpdatedCallback(f)
    }

    public async getAllSheetInfo(): Resp<readonly SheetInfo[]> {
        return this._workbook.getAllSheetInfo()
    }

    public async loadWorkbook(buf: Uint8Array, name: string): Resp<void> {
        await this._workbook.loadWorkbook({content: buf, name})
        this._sheetIdx = 0
        this._cellViews = new Map()
    }

    public getCurrentSheetIdx(): number {
        return this._sheetIdx
    }

    public setCurrentSheetIdx(idx: number): void {
        this._sheetIdx = idx
    }

    public async registryCustomFunc(f: CustomFunc) {
        return this._workbook.registryCustomFunc(f)
    }

    public registryCellUpdatedCallback(f: () => void): void {
        return this._workbook.registryCellUpdatedCallback(f)
    }

    public handleTransaction(transaction: Transaction): Resp<void> {
        return this._workbook.handleTransaction({transaction})
    }

    public undo(): Resp<void> {
        return this._workbook.undo()
    }

    public redo(): Resp<void> {
        return this._workbook.redo()
    }

    public getCellViewWithCell(
        sheetIdx: number,
        row: number,
        col: number,
        height: number,
        width: number
    ): Resp<CellViewResponse> {
        const cacheManager = this._cellViews.get(sheetIdx)
        if (!cacheManager) {
            const manager = new ViewManager(
                this._workbook,
                sheetIdx,
                this._pool
            )
            this._cellViews.set(sheetIdx, manager)
        }
        const viewManager = this._cellViews.get(sheetIdx) as ViewManager
        return viewManager.getViewResponseWithCell(row, col, height, width)
    }

    public getCellView(
        sheetIdx: number,
        startX: number,
        startY: number,
        height: number,
        width: number
    ): Resp<CellViewResponse> {
        const cacheManager = this._cellViews.get(sheetIdx)
        if (!cacheManager) {
            const manager = new ViewManager(
                this._workbook,
                sheetIdx,
                this._pool
            )
            this._cellViews.set(sheetIdx, manager)
        }
        const viewManager = this._cellViews.get(sheetIdx) as ViewManager
        return viewManager.getViewResponse(startX, startY, height, width)
    }

    private _init() {
        this._workbook.registryCellUpdatedCallback((): void => {
            // Clear all the cache
            this._cellViews = new Map()
        })
    }
    private _cellViews: Map<number, ViewManager> = new Map()

    private _sheetIdx = 0
}
