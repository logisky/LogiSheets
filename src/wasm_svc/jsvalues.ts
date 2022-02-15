
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
