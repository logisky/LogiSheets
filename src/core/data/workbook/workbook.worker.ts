/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-explicit-any */

const ctx: Worker = self as any

import {
    BlockInfo,
    CellInfo,
    CellPosition,
    DisplayWindowWithStartPoint,
    ErrorMessage,
    initWasm,
    MergeCell,
    SheetDimension,
    SheetInfo,
    Workbook,
    Worksheet,
} from 'logisheets-web'
import {
    GetAllSheetInfoParams,
    GetCellParams,
    GetDisplayWindowParams,
    GetDisplayWindowWithPositionParams,
    GetFullyCoveredBlocksParams,
    GetMergedCellsParams,
    HandleTransactionParams,
    LoadWorkbookParams,
    MethodName,
    WorkerUpdate,
} from './types'

type Result<T> = T | ErrorMessage

interface IWorkbookWorker {
    isReady(): Result<boolean>
    getAllSheetInfo(params: GetAllSheetInfoParams): Result<readonly SheetInfo[]>
    getDisplayWindow(
        params: GetDisplayWindowParams
    ): Result<DisplayWindowWithStartPoint>
    getCell(params: GetCellParams): Result<CellInfo>
    getCellPosition(params: GetCellParams): Result<CellPosition>
    getSheetDimension(sheetIdx: number): Result<SheetDimension>
    getFullyCoveredBlocks(
        params: GetFullyCoveredBlocksParams
    ): Result<readonly BlockInfo[]>

    undo(): Result<void>
    redo(): Result<void>
    handleTransaction(params: HandleTransactionParams): Result<void>

    loadWorkbook(params: LoadWorkbookParams): Result<void>
}

class WorkerService implements IWorkbookWorker {
    public getSheetDimension(sheetIdx: number): Result<SheetDimension> {
        const ws = this.getSheet(sheetIdx)
        return ws.getSheetDimension()
    }

    public isReady(): Result<boolean> {
        return this._workbookImpl != undefined
    }

    public getCell(params: GetCellParams): Result<CellInfo> {
        const ws = this.getSheet(params.sheetIdx)
        return ws.getCellInfo(params.row, params.col)
    }
    public getCellPosition(params: GetCellParams): Result<CellPosition> {
        const ws = this.getSheet(params.sheetIdx)
        return ws.getCellPosition(params.row, params.col)
    }
    public getFullyCoveredBlocks(
        params: GetFullyCoveredBlocksParams
    ): Result<readonly BlockInfo[]> {
        const ws = this.getSheet(params.sheetIdx)
        return ws.getFullyCoveredBlocks(
            params.row,
            params.col,
            params.height,
            params.width
        )
    }

    public getMergedCells(
        params: GetMergedCellsParams
    ): Result<readonly MergeCell[]> {
        const ws = this.getSheet(params.sheetIdx)
        return ws.getMergedCells(
            params.startRow,
            params.startCol,
            params.endRow,
            params.endCol
        )
    }

    public async init() {
        await initWasm()
        this._workbookImpl = new Workbook()
        this._workbookImpl.registerCellUpdatedCallback(() => {
            ctx.postMessage({id: WorkerUpdate.Cell})
        })
        this._workbookImpl.registerSheetInfoUpdateCallback(() => {
            ctx.postMessage({id: WorkerUpdate.Sheet})
        })
        // Inform the client that service is ready
        ctx.postMessage({id: WorkerUpdate.Ready})
    }

    public handleTransaction(params: HandleTransactionParams): void {
        this.workbook.execTransaction(params.transaction)
        return
    }

    public getAllSheetInfo(): readonly SheetInfo[] {
        return this.workbook.getAllSheetInfo()
    }

    public undo(): void {
        this.workbook.undo()
    }

    public redo(): void {
        this.workbook.redo()
    }

    public getDisplayWindow(
        params: GetDisplayWindowParams
    ): Result<DisplayWindowWithStartPoint> {
        const {sheetIdx, startX, startY, height, width} = params
        const ws = this.workbook.getWorksheet(sheetIdx)
        return ws.getDisplayWindowWithStartPoint(startX, startY, height, width)
    }

    public getDisplayWindowWithCellPosition(
        params: GetDisplayWindowWithPositionParams
    ): Result<DisplayWindowWithStartPoint> {
        const {sheetIdx, row, col, height, width} = params
        const ws = this.workbook.getWorksheet(sheetIdx)
        return ws.getDisplayWindowWithCellPosition(row, col, height, width)
    }

    public loadWorkbook(params: LoadWorkbookParams) {
        const {content, name} = params
        this._workbookImpl?.load(content, name)
        return
    }

    public getSheet(idx: number): Worksheet {
        return this.workbook.getWorksheet(idx)
    }

    public get workbook(): Workbook {
        if (!this._workbookImpl) throw Error("haven't been initialized")
        return this._workbookImpl
    }

    public async handleRequest(request: {m: string; args: any; id: number}) {
        const {m, args, id} = request

        if (!this._workbookImpl) {
            ctx.postMessage({error: 'WorkbookService not initialized', id})
            return
        }

        if (
            id === WorkerUpdate.Ready ||
            id === WorkerUpdate.Cell ||
            id === WorkerUpdate.CellAndSheet ||
            id === WorkerUpdate.Sheet
        )
            return

        let result
        switch (m) {
            case MethodName.IsReady:
                result = this.isReady()
                break
            case MethodName.HandleTransaction:
                result = this.handleTransaction(args)
                break
            case MethodName.GetAllSheetInfo:
                result = this.getAllSheetInfo()
                break
            case MethodName.Undo:
                result = this.undo()
                break
            case MethodName.Redo:
                result = this.redo()
                break
            case MethodName.GetDisplayWindow:
                result = this.getDisplayWindow(args)
                break
            case MethodName.GetCellPosition:
                result = this.getCellPosition(args)
                break
            case MethodName.GetCell:
                result = this.getCell(args)
                break
            case MethodName.LoadWorkbook:
                result = this.loadWorkbook(args)
                break
            case MethodName.GetFullyCoveredBlocks:
                result = this.getFullyCoveredBlocks(args)
                break
            case MethodName.GetSheetDimension:
                result = this.getSheetDimension(args)
                break
            case MethodName.GetMergedCells:
                result = this.getMergedCells(args)
                break
            default:
                throw new Error(`Unknown method: ${m}`)
        }

        ctx.postMessage({result, id})
    }

    private _workbookImpl: Workbook | undefined
}

// Worker thread execution
const workerService = new WorkerService()

workerService.init().then(() => {
    ctx.onmessage = (e) => {
        const request = e.data
        if (request && request.id) {
            workerService.handleRequest(request)
        }
    }
})
