import {Result as ResultType, Err, Ok, err, ok} from 'neverthrow'

export interface Error {
    message: string
    // if this is less than 1000, it represents a http status code
    // if this is greater or equal than 1000, it represents a system error
    code: number
}

export type Result<T> = ResultType<T, Error>
export type ResultAsync<T> = Promise<Result<T>>
export {err, ok, Err, Ok}

export enum ErrorType {
    BlockInfoNotFound = 1404,
    DescriptorNotFound = 2404,
    WorkbookError = 9999,
}

export function blockInfoNotFound(sheetId: number, blockId: number): Error {
    return {
        message: `block info not found for sheet ${sheetId} and block ${blockId}`,
        code: ErrorType.BlockInfoNotFound,
    }
}

export function descriptorNotFound(sheetId: number, blockId: number): Error {
    return {
        message: `descriptor not found for sheet ${sheetId} and block ${blockId}`,
        code: ErrorType.DescriptorNotFound,
    }
}

export function workbookError(message: string): Error {
    return {
        message: message,
        code: ErrorType.WorkbookError,
    }
}
