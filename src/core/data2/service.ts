import {inject, injectable} from 'inversify'
import {getID} from '../ioc/id'
import {TYPES} from '../ioc/types'
import {WorkbookService} from './workbook'
import {
    ActionEffect,
    CustomFunc,
    Transaction,
    Workbook,
    Worksheet,
    SheetInfo,
} from 'logisheets-web'
import {CellViewResponse, ViewManager} from './view_manager'
import {CellViewData} from './types'

export const MAX_COUNT = 100000000
export const CANVAS_OFFSET = 100

export interface DataService {
    registryCustomFunc: (f: CustomFunc) => void
    registryCellUpdatedCallback: (f: () => void) => void
    registrySheetUpdatedCallback: (f: () => void) => void
    handleTransaction: (t: Transaction) => ActionEffect
    undo: () => void
    redo: () => void

    getWorkbook: () => Workbook
    loadWorkbook: (buf: Uint8Array, name: string) => void
    getActiveSheet: () => Worksheet

    getCellView: (
        sheetIdx: number,
        startX: number,
        startY: number,
        height: number,
        width: number
    ) => CellViewResponse

    getCellViewWithCell: (
        sheetIdx: number,
        row: number,
        col: number,
        height: number,
        width: number
    ) => CellViewResponse

    getCurrentCellView: (sheetIdx: number) => readonly CellViewData[]

    getCurrentSheetIdx: () => number
    setCurrentSheetIDx: (idx: number) => void

    getAllSheetInfo: () => readonly SheetInfo[]
}

@injectable()
export class DataServiceImpl implements DataService {
    readonly id = getID()
    constructor(@inject(TYPES.Workbook) private _workbook: WorkbookService) {
        this._init()
    }

    public registrySheetUpdatedCallback(f: () => void): void {
        return this._workbook.registrySheetUpdatedCallback(f)
    }

    public getAllSheetInfo(): readonly SheetInfo[] {
        return this._workbook.getAllSheetInfo()
    }

    public loadWorkbook(buf: Uint8Array, name: string): void {
        this._workbook.loadWorkbook(buf, name)
        this._sheetIdx = 0
        this._cellViews = new Map()
    }

    public getActiveSheet(): Worksheet {
        return this._workbook.getSheetByIdx(this._sheetIdx)
    }

    public getCurrentSheetIdx(): number {
        return this._sheetIdx
    }

    public setCurrentSheetIDx(idx: number): void {
        this._sheetIdx = idx
    }

    public getWorkbook(): Workbook {
        return this._workbook.workbook
    }

    public registryCustomFunc(f: CustomFunc) {
        return this._workbook.registryCustomFunc(f)
    }

    public registryCellUpdatedCallback(f: () => void): void {
        return this._workbook.registryCellUpdatedCallback(f)
    }

    public handleTransaction(transaction: Transaction): ActionEffect {
        return this._workbook.handleTransaction(transaction)
    }

    public undo(): void {
        return this._workbook.undo()
    }

    public redo(): void {
        return this._workbook.redo()
    }

    public getCurrentCellView(sheetIdx: number): readonly CellViewData[] {
        const cacheManager = this._cellViews.get(sheetIdx)
        if (cacheManager) {
            return cacheManager.dataChunks
        }
        throw Error('trying to get cell view before rendering a sheet')
    }

    public getCellViewWithCell(
        sheetIdx: number,
        row: number,
        col: number,
        height: number,
        width: number
    ): CellViewResponse {
        const cacheManager = this._cellViews.get(sheetIdx)
        if (!cacheManager) {
            const manager = new ViewManager(this._workbook, sheetIdx)
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
    ): CellViewResponse {
        const cacheManager = this._cellViews.get(sheetIdx)
        if (!cacheManager) {
            const manager = new ViewManager(this._workbook, sheetIdx)
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
