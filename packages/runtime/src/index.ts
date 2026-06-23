// logisheets-runtime — a headless spreadsheet runtime for Node.
//
// This is the Node counterpart of the browser app: it wires logisheets-core's
// (engine-neutral) logic to the Node WASM engine via the injected-Client model.
// The browser supplies logisheets-engine's worker client; here we supply a
// synchronous client built on the Node WASM `handle()` entry point.
//
// Everything the runtime needs from the engine is funneled through the small
// ports that logisheets-core defines, so the logic stays shared and only the
// wiring lives here.

import {handle} from 'logisheets/wasm/logisheets_wasm_server.js'
import type {Value} from 'logisheets-web'
import {
    writeRecords,
    readRecords,
    checkValidations,
    checkFieldConstraints,
    type EnginePort,
    type ValidationPort,
    type CellReadPort,
    type WriteTarget,
    type ValidationRule,
    type FieldColumn,
    type Violation,
    type GatewayTransaction,
} from 'logisheets-core'

// Re-export the core surface so consumers import everything from one place.
export * from 'logisheets-core'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rpc = (method: string, value?: Record<string, unknown>) => any

/**
 * A live workbook in the Node WASM engine, with logisheets-core's logic
 * available as methods. Construct one per workbook.
 */
export class SpreadsheetRuntime
    implements EnginePort, CellReadPort, ValidationPort
{
    private readonly bookId: number
    private ephemeralSeq = 1

    private constructor(bookId: number) {
        this.bookId = bookId
    }

    /** Create an empty workbook. */
    public static create(): SpreadsheetRuntime {
        return new SpreadsheetRuntime(handle('newWorkbook') as number)
    }

    private readonly rpc: Rpc = (method, value) =>
        handle(value === undefined ? method : {method, value}, this.bookId)

    /** Release the workbook's engine resources. */
    public close(): void {
        this.rpc('release')
    }

    // ---- EnginePort -----------------------------------------------------
    public handleTransaction(tx: GatewayTransaction): {status: {type: string}} {
        return this.rpc('handleTransaction', {transaction: tx})
    }

    // ---- CellReadPort ---------------------------------------------------
    public getValue(sheetIdx: number, row: number, col: number): Value {
        return this.rpc('getValue', {sheetIdx, row, col})
    }

    // ---- ValidationPort -------------------------------------------------
    // Evaluate a formula by parking it in an ephemeral cell and reading the
    // engine's result — the same mechanism the browser uses for shadow cells.
    public evalFormula(sheetIdx: number, formula: string): Value {
        const id = this.ephemeralSeq++
        this.rpc('handleTransaction', {
            transaction: {
                payloads: [
                    {
                        type: 'ephemeralCellInput',
                        value: {sheetIdx, id, content: '=' + formula},
                    },
                ],
                undoable: false,
                temp: false,
            },
        })
        const sheetId = this.rpc('getSheetId', {sheetIdx}) as number
        const infos = this.rpc('batchGetCellInfoById', {
            ids: [{sheetId, cellId: {type: 'ephemeralCell', value: id}}],
        })
        return infos[0].value
    }

    // ---- High-level logisheets-core operations --------------------------

    /** Import: write rows of string cells into the sheet. */
    public writeRecords(
        target: WriteTarget,
        records: ReadonlyArray<ReadonlyArray<string>>,
        undoable = true
    ): boolean {
        return writeRecords(this, target, records, undoable)
    }

    /** Export: read a rectangle of evaluated values back out. */
    public readRecords(
        target: WriteTarget,
        rows: number,
        cols: number
    ): Value[][] {
        return readRecords(this, target, rows, cols)
    }

    /** Check formula-based validation rules; return violating cells. */
    public checkValidations(rules: readonly ValidationRule[]): Violation[] {
        return checkValidations(this, rules)
    }

    /** Check required / unique / membership field constraints. */
    public checkFieldConstraints(columns: readonly FieldColumn[]): Violation[] {
        return checkFieldConstraints(this, columns)
    }
}
