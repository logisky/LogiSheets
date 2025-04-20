export const enum WorkerUpdate {
    Cell = 0,
    Sheet = 1,
    CellAndSheet = 2,
    Ready = 3,
}

export enum MethodName {
    GetSheetDimension = 'getSheetDimension',
    GetFullyCoveredBlocks = 'getFullyCoveredBlocks',
    GetAllSheetInfo = 'getAllSheetInfo',
    GetDisplayWindow = 'getDisplayWindow',
    GetCell = 'getCell',
    GetCellPosition = 'getCellPosition',
    Undo = 'undo',
    Redo = 'redo',
    HandleTransaction = 'handleTransaction',
    LoadWorkbook = 'loadWorkbook',
    IsReady = 'isReady',
    GetMergedCells = 'getMergedCells',
    CalcCondition = 'calcCondition',

    GetBlockRowId = 'getBlockRowId',
    GetBlockColId = 'getBlockColId',
}
