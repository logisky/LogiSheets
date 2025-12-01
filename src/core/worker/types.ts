import {
    BlockInfo,
    CellInfo,
    CellPosition,
    DisplayWindowWithStartPoint,
    ErrorMessage,
    SheetDimension,
    SheetInfo,
    GetAllSheetInfoParams,
    GetCellParams,
    GetDisplayWindowParams,
    GetFullyCoveredBlocksParams,
    HandleTransactionParams,
    LoadWorkbookParams,
    GetBlockValuesParams,
    GetSheetIdxParams,
    GetAvailableBlockIdParams,
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
    FormulaDisplayInfo,
    BlockDisplayInfo,
    Comment,
    MergeCell,
    ActionEffect,
    SaveParams,
    SaveFileResult,
    Workbook,
} from 'logisheets-web'
import {RenderCell} from './render'

export const enum WorkerUpdate {
    Cell = 0,
    Sheet = 1,
    CellAndSheet = 2,
    Ready = 3,

    CellValueChanged = 4,
    CellRemoved = 5,
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
    HandleTransactionWithoutEvents = 'handleTransactionWithoutEvents',
    LoadWorkbook = 'loadWorkbook',
    IsReady = 'isReady',
    GetMergedCells = 'getMergedCells',
    CalcCondition = 'calcCondition',
    Save = 'save',

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

    GetShadowCellId = 'getShadowCellId',
    GetShadowCellIds = 'getShadowCellIds',
    GetShadowInfoById = 'getShadowInfoById',
    GetCellId = 'getCellId',

    GetDisplayUnitsOfFormula = 'getDisplayUnitsOfFormula',

    GetNextVisibleCell = 'getNextVisibleCell',

    GetAllBlockFields = 'getAllBlockFields',
    GetAppData = 'getAppData',
}

export enum OffscreenRenderName {
    Render = 'render',
    Resize = 'resize',
    Init = 'init',
    GetAppropriateHeights = 'getAppropriateHeights',
}

export interface AppropriateHeight {
    height: number
    row: number
    col: number
}

export interface Grid {
    anchorX: number
    anchorY: number
    rows: readonly Row[]
    columns: readonly Column[]
    mergeCells?: readonly MergeCell[]
    blockInfos?: readonly BlockDisplayInfo[]
    preRowHeight?: number
    preColWidth?: number
    nextRowHeight?: number
    nextColWidth?: number
}

export interface Row {
    height: number
    idx: number
}

export interface Column {
    width: number
    idx: number
}

export type Result<T> = T | ErrorMessage

export interface IWorkbookWorker {
    isReady(): Result<boolean>
    getAllSheetInfo(params: GetAllSheetInfoParams): Result<readonly SheetInfo[]>
    getWorkbook(): Workbook
    getDisplayWindow(
        params: GetDisplayWindowParams
    ): Result<DisplayWindowWithStartPoint>
    getCell(params: GetCellParams): Result<CellInfo>
    getCells(params: GetCellsParams): Result<readonly CellInfo[]>
    getCellsExceptWindow(
        params: GetCellsExceptWindowParams
    ): Result<readonly CellInfo[]>
    getReproducibleCell(
        params: GetReproducibleCellParams
    ): Result<ReproducibleCell>
    getReproducibleCells(
        params: GetReproducibleCellsParams
    ): Result<readonly ReproducibleCell[]>
    getValue(params: GetValueParams): Result<Value>
    getBlockInfo(params: GetBlockInfoParams): Result<BlockInfo>
    getCellPosition(params: GetCellParams): Result<CellPosition>
    getSheetDimension(sheetIdx: number): Result<SheetDimension>
    getFullyCoveredBlocks(
        params: GetFullyCoveredBlocksParams
    ): Result<readonly BlockInfo[]>

    undo(): Result<void>
    redo(): Result<void>
    handleTransaction(params: HandleTransactionParams): Result<void>
    handleTransactionWithoutEvents(
        params: HandleTransactionParams
    ): Result<ActionEffect>

    loadWorkbook(params: LoadWorkbookParams): Result<void>
    save(params: SaveParams): Result<SaveFileResult>

    getSheetIdx(params: GetSheetIdxParams): Result<number>
    getBlockValues(params: GetBlockValuesParams): Result<readonly string[]>

    getAvailableBlockId(params: GetAvailableBlockIdParams): Result<number>
    getDiyCellIdWithBlockId(
        params: GetDiyCellIdWithBlockIdParams
    ): Result<number>
    getSheetId(params: GetSheetIdParams): Result<number>
    lookupAppendixUpward(
        params: LookupAppendixUpwardParams
    ): Result<AppendixWithCell>

    getDisplayUnitsOfFormula(f: string): Result<FormulaDisplayInfo>
}

export interface IOffscreenWorker {
    render(sheetId: number, anchorX: number, anchorY: number): Result<Grid>
    resize(width: number, height: number, dpr: number): Result<Grid>
}

export class CellView {
    public constructor(public readonly data: CellViewData[]) {}

    public get fromRow(): number {
        let min = Infinity
        for (const d of this.data) {
            if (d.rows.length) {
                min = Math.min(min, d.rows[0].coordinate.startRow)
            }
        }
        return min
    }

    public get toRow(): number {
        let max = -Infinity
        for (const d of this.data) {
            if (d.rows.length) {
                max = Math.max(max, d.rows[d.rows.length - 1].coordinate.endRow)
            }
        }
        return max
    }

    public get fromCol(): number {
        let min = Infinity
        for (const d of this.data) {
            if (d.cols.length) {
                min = Math.min(min, d.cols[0].coordinate.startCol)
            }
        }
        return min
    }

    public get toCol(): number {
        let max = -Infinity
        for (const d of this.data) {
            if (d.cols.length) {
                max = Math.max(max, d.cols[d.cols.length - 1].coordinate.endCol)
            }
        }
        return max
    }

    public get rows(): readonly RenderCell[] {
        let curr = -1
        return this.data
            .flatMap((d) => d.rows)
            .sort((a, b) => a.coordinate.startRow - b.coordinate.startRow)
            .filter((r) => {
                if (r.position.startRow > curr) {
                    curr = r.position.startRow
                    return true
                }
                return false
            })
    }

    public get cols(): readonly RenderCell[] {
        let curr = -1
        return this.data
            .flatMap((d) => d.cols)
            .sort((a, b) => a.coordinate.startCol - b.coordinate.startCol)
            .filter((r) => {
                if (r.position.startCol > curr) {
                    curr = r.position.startCol
                    return true
                }
                return false
            })
    }

    public get cells(): readonly RenderCell[] {
        let currRow = -1
        let currCol = -1
        return this.data
            .flatMap((d) => d.cells)
            .filter((c) => {
                const col = c.position.startCol
                const row = c.position.startRow
                if (col <= currCol && row <= currRow) {
                    return false
                }
                currCol = col
                currRow = row
                return true
            })
    }

    public get mergeCells(): readonly RenderCell[] {
        return this.data.flatMap((d) => d.mergeCells)
    }

    public get blocks(): readonly BlockDisplayInfo[] {
        const set = new Set()
        const result: BlockDisplayInfo[] = []
        this.data.forEach((d) => {
            if (!d.blocks.length) {
                return
            }
            for (const block of d.blocks) {
                if (!set.has(block.info.blockId)) {
                    set.add(block.info.blockId)
                    result.push(block)
                }
            }
        })
        return result
    }
}

export class CellViewData {
    public fromRow = 0
    public toRow = 0
    public fromCol = 0
    public toCol = 0

    constructor(
        public rows: readonly RenderCell[],
        public cols: readonly RenderCell[],
        public cells: readonly RenderCell[],
        public mergeCells: readonly RenderCell[],
        public comments: readonly Comment[],
        public blocks: readonly BlockDisplayInfo[]
    ) {
        if (rows.length == 0) {
            throw Error('rows should not be empty')
        }
        if (cols.length == 0) {
            throw Error('cols should not be empty')
        }
        if (cells.length == 0) {
            throw Error('cells should not be empty')
        }
        this.fromRow = rows[0].coordinate.startRow
        this.toRow = rows[rows.length - 1].coordinate.endRow
        this.fromCol = cols[0].coordinate.startCol
        this.toCol = cols[cols.length - 1].coordinate.endCol
    }
}

export class Rect {
    constructor(
        public readonly startX: number,
        public readonly startY: number,
        public readonly width: number,
        public readonly height: number
    ) {}

    get endX(): number {
        return this.startX + this.width
    }

    get endY(): number {
        return this.startY + this.height
    }

    /**
     * Checks if this rectangle fully contains another rectangle.
     */
    contains(other: Rect): boolean {
        return (
            this.startX <= other.startX &&
            this.endX >= other.endX &&
            this.startY <= other.startY &&
            this.endY >= other.endY
        )
    }

    public static fromCellViewData(data: CellViewData): Rect {
        const rowLen = data.rows.length
        const colLen = data.cols.length
        if (rowLen == 0 || colLen == 0)
            throw Error('cell view data should not have empty row or col')

        const startRow = data.rows[0].position.startRow
        const startCol = data.cols[0].position.startCol
        const endRow = data.rows[rowLen - 1].position.endRow
        const endCol = data.cols[colLen - 1].position.endCol
        return new Rect(
            startRow,
            startCol,
            endRow - startRow,
            endCol - startCol
        )
    }
}
export class OverlapResult {
    constructor(
        public readonly targets: Rect[],
        public readonly ty: OverlapType
    ) {}
}

export enum OverlapType {
    FullyCovered,
    PartiallyCovered,
    Uncovered,
}

export interface RenderArgs {
    sheetId: number
    anchorX: number
    anchorY: number
}

export interface ScrollArgs {
    delta: number
}

export interface ResizeArgs {
    width: number
    height: number
}
