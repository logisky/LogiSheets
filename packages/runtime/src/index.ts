// logisheets-runtime — a headless spreadsheet runtime for Node.
//
// This is the Node counterpart of the browser app: it wires logisheets-core's
// (engine-neutral) logic to the Node WASM engine via the injected-Client model.
// The browser supplies logisheets-engine's worker client; here we supply a
// synchronous client built on the Node WASM `handle()` entry point.
//
// A single {@link SpreadsheetRuntime} owns many {@link Workbook}s at once
// (wb1, wb2, wb3, …); every operation runs against one specific workbook. All
// workbook logic lives in logisheets-core's WorkbookOps; the runtime only
// adapts the synchronous Node `handle()` entry point into the async Client that
// WorkbookOps consumes, then exposes that ops layer per workbook.

import {readFile} from 'node:fs/promises'
import {basename, resolve} from 'node:path'
import {handle} from 'logisheets/wasm/logisheets_wasm_server.js'
import type {Value, Client} from 'logisheets-web'
import {WorkbookOps} from 'logisheets-core'

// Re-export the core surface so consumers import everything from one place.
export * from 'logisheets-core'

// The developer-defined JSON-RPC server (operations run against this runtime).
export * from './rpc.js'

// Craft loading: reconstruct the crafts a workbook depends on, headlessly.
export * from './craft.js'

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
 * A single live workbook in the Node WASM engine, with logisheets-core's logic
 * available as methods. You don't construct one directly — obtain it from
 * {@link SpreadsheetRuntime.createWorkbook} or
 * {@link SpreadsheetRuntime.loadWorkbook}, then run every operation against
 * this handle so the target workbook is always explicit.
 */
export class Workbook {
    /** The workbook's engine id (unique across the whole process). */
    public readonly id: number
    /** The shared, engine-neutral operation layer, bound to this workbook. */
    public readonly ops: WorkbookOps
    /**
     * The raw async {@link Client} bound to this workbook — every
     * `WorkbookMethods` call mapped onto the Node engine. This is the
     * last-resort escape hatch: prefer {@link ops}, but when an operation has
     * no `WorkbookOps` method yet, you can drive the engine directly here.
     */
    public readonly client: Client
    /** Absolute path this workbook was loaded from, if any. */
    public readonly path?: string

    private released = false

    /** @internal Construct via {@link SpreadsheetRuntime}. */
    public constructor(bookId: number, path?: string) {
        this.id = bookId
        this.client = makeNodeClient(bookId)
        this.ops = new WorkbookOps(this.client)
        this.path = path
    }

    /** Read a single cell's evaluated value. */
    public getValue(sheetIdx: number, row: number, col: number): Value {
        return handle(
            {method: 'getValue', value: {sheetIdx, row, col}},
            this.id
        )
    }

    /** Undo the most recent transaction. Returns whether anything was undone. */
    public async undo(): Promise<boolean> {
        return (await this.client.undo()) === true
    }

    /** Redo the most recently undone transaction. Returns whether anything was redone. */
    public async redo(): Promise<boolean> {
        return (await this.client.redo()) === true
    }

    /**
     * Drop the undo/redo history, keeping the current state as the baseline.
     * Nothing is reverted — only the history is cleared (bounds memory and
     * makes prior changes permanent).
     */
    public async cleanHistory(): Promise<void> {
        await this.client.cleanHistory()
    }

    /**
     * Revert every change still on the undo stack, returning the workbook to
     * its current baseline. Assumes the history was clean at the baseline (the
     * mutation lifecycle in {@link RpcServer.registerMutation} guarantees this),
     * so it undoes exactly the changes made since.
     */
    public async discardChanges(): Promise<void> {
        // eslint-disable-next-line no-await-in-loop
        while ((await this.client.undo()) === true) {
            /* keep undoing until the stack is empty */
        }
    }

    /** @internal Release engine resources. Use {@link SpreadsheetRuntime.close}. */
    public release(): void {
        if (this.released) return
        this.released = true
        handle('release', this.id)
    }
}

/**
 * The headless runtime: a container for many open {@link Workbook}s. Create one
 * per Node process, then load or create as many workbooks as you need — each
 * operation is issued against the specific workbook handle you hold.
 *
 * ```ts
 * const rt = new SpreadsheetRuntime()
 * const wb1 = await rt.loadWorkbook('a.xlsx')
 * const wb2 = await rt.loadWorkbook('b.xlsx')
 * const wb3 = rt.createWorkbook()
 * await wb1.ops.inputCell(0, 0, 0, 'hi')
 * ```
 */
export class SpreadsheetRuntime {
    /** Loaded-from-disk workbooks, keyed by absolute path, for dedup. */
    private readonly byPath = new Map<string, Workbook>()
    /** Every open workbook this runtime owns. */
    private readonly open = new Set<Workbook>()

    /** Create a new empty workbook. */
    public createWorkbook(): Workbook {
        const wb = new Workbook(handle('newWorkbook') as number)
        this.open.add(wb)
        return wb
    }

    /**
     * Load a workbook from a .xlsx file on disk. Calling this twice with the
     * same path returns the already-loaded {@link Workbook} rather than
     * reloading — {@link close} it to release the engine and clear the entry.
     */
    public async loadWorkbook(path: string): Promise<Workbook> {
        const key = resolve(path)
        const existing = this.byPath.get(key)
        if (existing) return existing

        const content = await readFile(key)
        const wb = this.loadWorkbookFromBytes(content, basename(key), key)
        this.byPath.set(key, wb)
        return wb
    }

    /**
     * Load a workbook from raw .xlsx bytes already in memory.
     *
     * @param name file name used by the engine (e.g. for the workbook title)
     */
    public loadWorkbookFromBytes(
        content: Uint8Array,
        name: string,
        path?: string
    ): Workbook {
        const bookId = handle('newWorkbook') as number
        // The engine's deserializer expects a plain number array, not a
        // typed array / Buffer — mirror the browser SDK's `Array.from(buf)`.
        const code = handle(
            {
                method: 'loadWorkbook',
                value: {content: Array.from(content), name},
            },
            bookId
        ) as number
        if (code !== 0) {
            handle('release', bookId)
            throw new Error(`failed to load workbook "${name}" (code ${code})`)
        }
        const wb = new Workbook(bookId, path)
        this.open.add(wb)
        return wb
    }

    /** All workbooks currently open in this runtime. */
    public get workbooks(): readonly Workbook[] {
        return [...this.open]
    }

    /** Close one workbook, releasing its engine resources. */
    public close(wb: Workbook): void {
        this.open.delete(wb)
        if (wb.path !== undefined) this.byPath.delete(wb.path)
        wb.release()
    }

    /** Close every open workbook. */
    public closeAll(): void {
        for (const wb of [...this.open]) this.close(wb)
    }
}
