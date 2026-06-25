// logisheets-runtime — a headless spreadsheet runtime for Node.
//
// This is the Node counterpart of the browser app: it wires logisheets-core's
// (engine-neutral) logic to the Node WASM engine via the injected-Client model.
// The browser supplies logisheets-engine's worker client; here we supply a
// synchronous client built on the Node WASM `handle()` entry point.
//
// All workbook logic lives in logisheets-core's WorkbookOps; the runtime only
// adapts the synchronous Node `handle()` entry point into the async Client that
// WorkbookOps consumes, then exposes that ops layer.

import {handle} from 'logisheets/wasm/logisheets_wasm_server.js'
import type {Value, Client} from 'logisheets-web'
import {
    WorkbookOps,
    type ValidationRule,
    type FieldColumn,
    type Violation,
} from 'logisheets-core'

// Re-export the core surface so consumers import everything from one place.
export * from 'logisheets-core'

/**
 * Adapt the synchronous Node `handle()` entry point into the async {@link
 * Client} that logisheets-core's operation layer expects.
 *
 * Every WorkbookMethods call has the shape `client.method(params)` and maps
 * 1:1 onto `handle({method, value: params}, bookId)`, so a single generic
 * Proxy covers the whole interface — no per-method boilerplate. Results are
 * wrapped in a resolved Promise so a Node caller can `await` exactly like the
 * browser. The callback/register* members are not used by the operation layer
 * and are intentionally absent.
 */
function makeNodeClient(bookId: number): Client {
    return new Proxy(
        {},
        {
            get(_target, prop) {
                const method = String(prop)
                return (params?: Record<string, unknown>) =>
                    Promise.resolve(
                        handle(
                            params === undefined
                                ? method
                                : {method, value: params},
                            bookId
                        )
                    )
            },
        }
    ) as unknown as Client
}

/**
 * A live workbook in the Node WASM engine, with logisheets-core's logic
 * available as methods. Construct one per workbook.
 */
export class SpreadsheetRuntime {
    private readonly bookId: number
    /** The shared, engine-neutral operation layer, bound to this workbook. */
    public readonly ops: WorkbookOps

    private constructor(bookId: number) {
        this.bookId = bookId
        this.ops = new WorkbookOps(makeNodeClient(bookId))
    }

    /** Create an empty workbook. */
    public static create(): SpreadsheetRuntime {
        return new SpreadsheetRuntime(handle('newWorkbook') as number)
    }

    /** Read a single cell's evaluated value. */
    public getValue(sheetIdx: number, row: number, col: number): Value {
        return handle(
            {method: 'getValue', value: {sheetIdx, row, col}},
            this.bookId
        )
    }

    /** Release the workbook's engine resources. */
    public close(): void {
        handle('release', this.bookId)
    }

    // ---- High-level operations (thin delegators to ops) -----------------

    /** Write a value or formula into a cell. */
    public inputCell(
        sheetIdx: number,
        row: number,
        col: number,
        content: string
    ): Promise<unknown> {
        return this.ops.inputCell(sheetIdx, row, col, content)
    }

    /** Check formula-based validation rules; return violating cells. */
    public checkValidations(
        rules: readonly ValidationRule[]
    ): Promise<Violation[]> {
        return this.ops.checkValidations(rules)
    }

    /** Check required / unique / membership field constraints. */
    public checkFieldConstraints(
        columns: readonly FieldColumn[]
    ): Promise<Violation[]> {
        return this.ops.checkFieldConstraints(columns)
    }

    /**
     * Establish a cell's validation rule — the same operation the browser
     * runs, served from logisheets-core's WorkbookOps.
     */
    public setValidationRule(
        sheetIdx: number,
        row: number,
        col: number,
        formula: string
    ): Promise<void> {
        return this.ops.setValidationRule(sheetIdx, row, col, formula)
    }
}
