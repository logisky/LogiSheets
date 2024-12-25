import {Transaction} from 'logisheets-web'

export interface GetAllSheetInfoParams {}

export interface GetDisplayWindowParams {
    sheetIdx: number
    startX: number
    startY: number
    height: number
    width: number
}

export interface GetDisplayWindowWithPositionParams {
    sheetIdx: number
    row: number
    col: number
    height: number
    width: number
}

export interface GetCellParams {
    sheetIdx: number
    row: number
    col: number
}

export interface HandleTransactionParams {
    transaction: Transaction
}

export interface LoadWorkbookParams {
    content: Uint8Array
    name: string
}

export interface MessageResp<T> {
    result: T
    id: number
}

export interface GetFullyCoveredBlocksParams {
    sheetIdx: number
    row: number
    col: number
    height: number
    width: number
}

export const enum WorkerUpdate {
    Cell = 0,
    Sheet = 1,
    CellAndSheet = 2,
    Ready = 3,
}

export type Callback = () => void
