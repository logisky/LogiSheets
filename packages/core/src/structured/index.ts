// Structured-data primitives — the engine-facing core of data-gateway.
//
// These functions are the import/export building blocks: write a 2-D block of
// records into the workbook, and read a rectangle of records back out. They
// are PURE LOGIC: they never import a concrete engine. They talk to whatever
// engine the host injects through the minimal `EnginePort` seam below.
//
//   - browser:  wrap logisheets-engine's worker-backed client as an EnginePort
//   - node:     wrap logisheets' synchronous handle()/Workbook as an EnginePort
//
// The payload/value shapes are imported as TYPES from logisheets-web, so this
// file still carries no runtime dependency.

import type {Value} from 'logisheets-web'

/** The slice of the engine that structured-data ops actually need. */
export interface EnginePort {
    /** Apply a cell-input transaction. Returns the engine's status object. */
    handleTransaction(tx: GatewayTransaction): {status: {type: string}}
    /** Read a single cell's evaluated value. */
    getValue(sheetIdx: number, row: number, col: number): Value
}

export interface GatewayTransaction {
    payloads: ReadonlyArray<{
        type: 'cellInput'
        value: {sheetIdx: number; row: number; col: number; content: string}
    }>
    undoable: boolean
    temp: boolean
}

export interface WriteTarget {
    sheetIdx: number
    startRow: number
    startCol: number
}

/**
 * Import: write `records` (rows of string cells) into the sheet, anchored at
 * (startRow, startCol). One transaction for the whole block. Returns true on
 * an `ok` engine status.
 */
export function writeRecords(
    port: EnginePort,
    target: WriteTarget,
    records: ReadonlyArray<ReadonlyArray<string>>,
    undoable = true
): boolean {
    const payloads: Array<GatewayTransaction['payloads'][number]> = []
    records.forEach((row, r) => {
        row.forEach((content, c) => {
            payloads.push({
                type: 'cellInput',
                value: {
                    sheetIdx: target.sheetIdx,
                    row: target.startRow + r,
                    col: target.startCol + c,
                    content,
                },
            })
        })
    })
    const effect = port.handleTransaction({payloads, undoable, temp: false})
    return effect.status.type === 'ok'
}

/**
 * Export: read a `rows` x `cols` rectangle of evaluated values back out as a
 * 2-D array, anchored at (startRow, startCol).
 */
export function readRecords(
    port: EnginePort,
    target: WriteTarget,
    rows: number,
    cols: number
): Value[][] {
    const out: Value[][] = []
    for (let r = 0; r < rows; r++) {
        const line: Value[] = []
        for (let c = 0; c < cols; c++) {
            line.push(
                port.getValue(
                    target.sheetIdx,
                    target.startRow + r,
                    target.startCol + c
                )
            )
        }
        out.push(line)
    }
    return out
}
