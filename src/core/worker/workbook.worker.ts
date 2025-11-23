/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    BlockInfo,
    CellInfo,
    CellPosition,
    DisplayWindowWithStartPoint,
    initWasm,
    MergeCell,
    SheetDimension,
    SheetInfo,
    Workbook,
    Worksheet,
    GetCellParams,
    GetDisplayWindowParams,
    GetDisplayWindowWithPositionParams,
    GetFullyCoveredBlocksParams,
    GetMergedCellsParams,
    HandleTransactionParams,
    LoadWorkbookParams,
    CalcConditionParams,
    GetBlockRowIdParams,
    RowId,
    GetBlockColIdParams,
    ColId,
    GetBlockValuesParams,
    GetSheetIdxParams,
    GetAvailableBlockIdParams,
    DisplayWindow,
    GetBlockDisplayWindowParams,
    GetDiyCellIdWithBlockIdParams,
    GetCellsExceptWindowParams,
    GetSheetIdParams,
    AppendixWithCell,
    LookupAppendixUpwardParams,
    GetCellsParams,
    GetBlockInfoParams,
    ReproducibleCell,
    GetReproducibleCellsParams,
    GetReproducibleCellParams,
    GetCellValueParams as GetValueParams,
    Value,
    GetShadowCellIdsParams,
    GetShadowCellIdParams,
    ShadowCellInfo,
    GetShadowInfoByIdParams,
    GetCellIdParams,
    SheetCellId,
    FormulaDisplayInfo,
    CellCoordinate,
    GetNextVisibleCellParams,
    ActionEffect,
    BlockField,
    SaveParams,
} from 'logisheets-web'
import {WorkerUpdate, MethodName, Result, IWorkbookWorker} from './types'
import {SaveFileResult} from 'packages/web'

export class WorkerService implements IWorkbookWorker {
    constructor(private _ctx: Worker) {}

    getDisplayUnitsOfFormula(f: string): Result<FormulaDisplayInfo> {
        return this.workbook.getDisplayUnitsOfFormula(f)
    }
    getValue(params: GetValueParams): Result<Value> {
        const {sheetId, row, col} = params
        const ws = this._workbookImpl!.getWorksheetById(sheetId)
        return ws.getValue(row, col)
    }
    getReproducibleCell(
        params: GetReproducibleCellParams
    ): Result<ReproducibleCell> {
        const {sheetIdx, row, col} = params
        const ws = this.getSheet(sheetIdx)
        return ws.getReproducibleCell(row, col)
    }
    getReproducibleCells(
        params: GetReproducibleCellsParams
    ): Result<readonly ReproducibleCell[]> {
        const {sheetIdx, coordinates} = params
        const ws = this.getSheet(sheetIdx)
        return ws.getReproducibleCells(coordinates)
    }
    lookupAppendixUpward(
        params: LookupAppendixUpwardParams
    ): Result<AppendixWithCell> {
        const {sheetId, blockId, row, col, craftId, tag} = params
        const ws = this.workbook.getWorksheetById(sheetId)
        return ws.lookupAppendixUpward(blockId, row, col, craftId, tag)
    }
    public getSheetId(params: GetSheetIdParams): Result<number> {
        const {sheetIdx} = params
        return this.workbook.getSheetId(sheetIdx)
    }
    public getDiyCellIdWithBlockId(
        params: GetDiyCellIdWithBlockIdParams
    ): Result<number> {
        const {sheetId, blockId, row, col} = params
        const ws = this.workbook.getWorksheetById(sheetId)
        return ws.getDiyCellIdWithBlockId(blockId, row, col)
    }
    public getAvailableBlockId(
        params: GetAvailableBlockIdParams
    ): Result<number> {
        return this.workbook.getAvailableBlockId(params)
    }

    public getSheetIdx(params: GetSheetIdxParams): Result<number> {
        const {sheetId} = params
        return this.workbook.getSheetIdx(sheetId)
    }

    public getBlockValues(
        params: GetBlockValuesParams
    ): Result<readonly string[]> {
        const {sheetId, blockId, rowIds, colIds} = params
        return this.workbook.getBlockValues({
            sheetId,
            blockId,
            rowIds: rowIds,
            colIds: colIds,
        })
    }

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
    public getCells(params: GetCellsParams): Result<readonly CellInfo[]> {
        const ws = this.getSheet(params.sheetIdx)
        return ws.getCellInfos(
            params.startRow,
            params.startCol,
            params.endRow,
            params.endCol
        )
    }
    public getCellsExceptWindow(
        params: GetCellsExceptWindowParams
    ): Result<readonly CellInfo[]> {
        const ws = this.getSheet(params.sheetIdx)
        return ws.getCellInfosExceptWindow(
            params.startRow,
            params.startCol,
            params.endRow,
            params.endCol,
            params.windowStartRow,
            params.windowStartCol,
            params.windowEndRow,
            params.windowEndCol
        )
    }

    public getCellId(params: GetCellIdParams): Result<SheetCellId> {
        return this.workbook.getCellId(params)
    }

    public getShadowCellId(params: GetShadowCellIdParams): Result<number> {
        return this.workbook.getShadowCellId(params)
    }

    public getShadowCellIds(
        params: GetShadowCellIdsParams
    ): Result<readonly number[]> {
        return this.workbook.getShadowCellIds(params)
    }

    public getShadowInfoById(
        params: GetShadowInfoByIdParams
    ): Result<ShadowCellInfo> {
        return this.workbook.getShadowInfoById(params.shadowId)
    }

    public getBlockInfo(params: GetBlockInfoParams): Result<BlockInfo> {
        const ws = this.getSheet(params.sheetId)
        return ws.getBlockInfo(params.blockId)
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
            this._ctx.postMessage({id: WorkerUpdate.Cell})
        })
        this._workbookImpl.registerSheetInfoUpdateCallback(() => {
            this._ctx.postMessage({id: WorkerUpdate.Sheet})
        })
        // Inform the client that service is ready
        this._ctx.postMessage({id: WorkerUpdate.Ready})
    }

    public handleTransaction(params: HandleTransactionParams): void {
        const result = this.workbook.execTransaction(params.transaction)
        result.valueChanged.forEach((cellId) => {
            this._ctx.postMessage({
                id: WorkerUpdate.CellValueChanged,
                result: cellId,
            })
        })
        result.cellRemoved.forEach((cellId) => {
            this._ctx.postMessage({
                id: WorkerUpdate.CellRemoved,
                result: cellId,
            })
        })
        return
    }

    public handleTransactionWithoutEvents(
        params: HandleTransactionParams
    ): Result<ActionEffect> {
        return this.workbook.execTransaction(params.transaction)
    }

    public getAllSheetInfo(): readonly SheetInfo[] {
        return this.workbook.getAllSheetInfo()
    }

    public getBlockRowId(params: GetBlockRowIdParams): Result<RowId> {
        const {sheetId, blockId, rowIdx} = params
        return this.workbook.getBlockRowId(sheetId, blockId, rowIdx)
    }

    public getBlockColId(params: GetBlockColIdParams): Result<ColId> {
        const {sheetId, blockId, colIdx} = params
        return this.workbook.getBlockColId(sheetId, blockId, colIdx)
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

    public save(params: SaveParams): Result<SaveFileResult> {
        const {appData} = params
        return this._workbookImpl!.save(appData)
    }

    public getAllBlockFields(): Result<readonly BlockField[]> {
        return this.workbook.getAllBlockFields()
    }

    public calcCondition(params: CalcConditionParams): Result<boolean> {
        const {sheetIdx, condition} = params
        return this.workbook.calcCondition(sheetIdx, condition)
    }

    public getSheet(idx: number): Worksheet {
        return this.workbook.getWorksheet(idx)
    }

    public getBlockDisplayWindow(
        params: GetBlockDisplayWindowParams
    ): Result<DisplayWindow> {
        const {sheetId, blockId} = params
        const ws = this.workbook.getWorksheetById(sheetId)
        return ws.getBlockDisplayWindow(blockId)
    }

    getWorkbook(): Workbook {
        return this.workbook
    }

    public get workbook(): Workbook {
        if (!this._workbookImpl) throw Error("haven't been initialized")
        return this._workbookImpl
    }

    public async handleRequest(request: {m: string; args: any; id: number}) {
        const {m, args, id} = request

        if (!this._workbookImpl) {
            this._ctx.postMessage({
                error: 'WorkbookService not initialized',
                id,
            })
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
            case MethodName.CalcCondition:
                result = this.calcCondition(args)
                break
            case MethodName.GetBlockRowId:
                result = this.getBlockRowId(args)
                break
            case MethodName.GetBlockColId:
                result = this.getBlockColId(args)
                break
            case MethodName.GetBlockValues:
                result = this.getBlockValues(args)
                break
            case MethodName.GetAvailableBlockId:
                result = this.getAvailableBlockId(args)
                break
            case MethodName.GetBlockDisplayWindow:
                result = this.getBlockDisplayWindow(args)
                break
            case MethodName.GetSheetId:
                result = this.getSheetId(args)
                break
            case MethodName.GetSheetIdx:
                result = this.getSheetIdx(args)
                break
            case MethodName.GetBlockInfo:
                result = this.getBlockInfo(args)
                break
            case MethodName.GetReproducibleCells:
                result = this.getReproducibleCells(args)
                break
            case MethodName.LookupAppendixUpward:
                result = this.lookupAppendixUpward(args)
                break
            case MethodName.GetCellValue:
                result = this.getValue(args)
                break
            case MethodName.GetCells:
                result = this.getCells(args)
                break
            case MethodName.GetShadowCellId:
                result = this.getShadowCellId(args)
                break
            case MethodName.GetShadowCellIds:
                result = this.getShadowCellIds(args)
                break
            case MethodName.GetShadowInfoById:
                result = this.getShadowInfoById(args)
                break
            case MethodName.GetCellId:
                result = this.getCellId(args)
                break
            case MethodName.GetDisplayUnitsOfFormula:
                result = this.getDisplayUnitsOfFormula(args)
                break
            case MethodName.GetNextVisibleCell:
                result = this.getNextVisibleCell(args)
                break
            case MethodName.HandleTransactionWithoutEvents:
                result = this.handleTransactionWithoutEvents(args)
                break
            case MethodName.Save:
                result = this.save(args)
                break
            case MethodName.GetAllBlockFields:
                result = this.getAllBlockFields()
                break
            default:
                throw new Error(`Unknown method: ${m}`)
        }

        this._ctx.postMessage({result, id})
    }

    getNextVisibleCell(args: GetNextVisibleCellParams): Result<CellCoordinate> {
        const ws = this.workbook.getWorksheet(args.sheetIdx)
        if (args.direction === 'up') {
            return ws.getNextUpwardVisibleCell(args.rowIdx, args.colIdx)
        } else if (args.direction === 'down') {
            return ws.getNextDownwardVisibleCell(args.rowIdx, args.colIdx)
        } else if (args.direction === 'left') {
            return ws.getNextLeftwardVisibleCell(args.rowIdx, args.colIdx)
        } else {
            return ws.getNextRightwardVisibleCell(args.rowIdx, args.colIdx)
        }
    }

    private _workbookImpl: Workbook | undefined
}
