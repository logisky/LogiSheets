// TODO: Use `gents` to generate these interfaces and move them to `src/bindings`.

import {ActionEffect} from "@/bindings"
import {Task} from "@/bindings"

export interface TransactionEndResult {
    readonly code: TransactionCode
    readonly effect: ActionEffect
}

export const enum TransactionCode {
    Ok,
    Err,
}

export interface AsyncFuncResult {
    tasks: readonly Task[]
    values: readonly string[]
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
