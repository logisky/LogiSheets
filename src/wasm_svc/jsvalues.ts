
export interface TransactionEndResult {
    readonly code: TransactionCode
    readonly tasks: Task[]
    readonly asyncId: number
    readonly sheetIdx: number[]
}

export const enum TransactionCode {
    Ok,
    Err,
}

export interface Task {
    readonly asyncFunc: string,
    readonly args: string[],
}

export interface AsyncFuncResult {
    asyncId: number,
    values: string[]
}

export interface DisplayResponse {
    readonly patches: readonly DisplayPatch[]
}

export interface DisplayPatch {
    values?: SheetValues
    styles?: SheetStyles
    rowInfo?: SheetRowInfo
    colInfo?: SheetColInfo
    mergeCells?: SheetMergeCells
}

export interface SheetValues {}

export interface SheetStyles {}

export interface SheetRowInfo {}

export interface SheetColInfo {}
export interface SheetMergeCells {}
