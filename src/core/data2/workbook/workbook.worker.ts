/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-explicit-any */

const ctx: Worker = self as any

import {
    ActionEffect,
    BlockInfo,
    CellInfo,
    CellPosition,
    DisplayWindowWithStartPoint,
    ErrorMessage,
    initWasm,
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
    HandleTransactionParams,
    LoadWorkbookParams,
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
    getFullyCoveredBlocks(
        params: GetFullyCoveredBlocksParams
    ): Result<readonly BlockInfo[]>

    undo(): Result<void>
    redo(): Result<void>
    handleTransaction(params: HandleTransactionParams): Result<ActionEffect>

    loadWorkbook(params: LoadWorkbookParams): Result<void>
}

class WorkerService implements IWorkbookWorker {
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

    public async init() {
        console.log(',,,,,,,,')
        await initWasm()
        console.log('1111111')
        this._workbookImpl = new Workbook()
        this._workbookImpl.registerCellUpdatedCallback(() => {
            ctx.postMessage({id: WorkerUpdate.Cell})
        })
        this._workbookImpl.registerSheetInfoUpdateCallback(() => {
            ctx.postMessage({id: WorkerUpdate.Sheet})
        })
        // Inform the client that service is ready
        ctx.postMessage({id: WorkerUpdate.Ready})
        console.log('????')
    }

    public handleTransaction(params: HandleTransactionParams): ActionEffect {
        return this.workbook.execTransaction(params.transaction)
    }

    public getAllSheetInfo(): readonly SheetInfo[] {
        return this.workbook.getAllSheetInfo()
    }

    public undo() {
        this.workbook.undo()
    }

    public redo() {
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
            case 'isReady':
                result = this.isReady()
                break
            case 'handleTransaction':
                result = this.handleTransaction(args)
                break
            case 'getAllSheetInfo':
                result = this.getAllSheetInfo()
                break
            case 'undo':
                result = this.undo()
                break
            case 'redo':
                result = this.redo()
                break
            case 'getDisplayWindow':
                result = this.getDisplayWindow(args)
                break
            case 'getDisplayWindowWithCellPosition':
                result = this.getDisplayWindowWithCellPosition(args)
                break
            case 'getCellPosition':
                result = this.getCellPosition(args)
                break
            case 'getCell':
                result = this.getCell(args)
                break
            case 'loadWorkbook':
                result = this.loadWorkbook(args)
                break
            case 'getFullyCoveredBlocks':
                result = this.getFullyCoveredBlocks(args)
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

console.log('sssssssss')
workerService.init().then(() => {
    ctx.onmessage = (e) => {
        const request = e.data
        if (request && request.id) {
            workerService.handleRequest(request)
        }
    }
})
