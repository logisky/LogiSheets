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
    GetBlockDisplayWindow = 'getBlockDisplayWindow',
    GetCell = 'getCell',
    GetCells = 'getCells',
    GetCellsExceptWindow = 'getCellsExceptWindow',
    GetBlockInfo = 'getBlockInfo',
    GetCellPosition = 'getCellPosition',
    Undo = 'undo',
    Redo = 'redo',
    HandleTransaction = 'handleTransaction',
    LoadWorkbook = 'loadWorkbook',
    IsReady = 'isReady',
    GetMergedCells = 'getMergedCells',
    CalcCondition = 'calcCondition',

    LookupAppendixUpward = 'lookupAppendixUpward',

    GetBlockRowId = 'getBlockRowId',
    GetBlockColId = 'getBlockColId',

    GetSheetIdx = 'getSheetIdx',
    GetSheetId = 'getSheetId',
    GetBlockValues = 'getBlockValues',
    GetAvailableBlockId = 'getAvailableBlockId',

    GetDiyCellIdWithBlockId = 'getDiyCellIdWithBlockId',

    GetReproducibleCell = 'getReproducibleCell',
    GetReproducibleCells = 'getReproducibleCells',
    GetCellValue = 'getCellValue',
}
