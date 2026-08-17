/**
 * Authoring types for craft `tools.ts` files.
 *
 * A tool is a plain exported function whose first parameter is the host-injected
 * `SkillCtx`. `craftsmith` reads the rest of the signature to build the tool's
 * JSON-Schema input; the `ctx` parameter is never exposed to the LLM.
 *
 * This mirrors `logician`'s `ToolContext` (packages/logician/src/tool.ts) but is
 * declared here so a craft can depend on `craftsmith` alone, without pulling in
 * the whole agent engine. The two are kept structurally compatible on purpose.
 *
 * Annotations (JSDoc, read statically by `craftsmith` — no runtime decorators):
 *
 *   // module-level, once per craft — becomes manifest.skill
 *   /** @logicianSkill <when to use this craft>
 *    *  @guidance <optional prompt fragment injected on use> *␟/
 *
 *   // per exported function — becomes one manifest tool
 *   /** @tool <one-line description>
 *    *  @param name <description>
 *    *  @mutates none|temp|true      (default: none)
 *    *  @confirm never|once|always|destructive   (default: never) *␟/
 *   export async function doThing(ctx: SkillCtx, a: string, b: number) { … }
 */

/** Minimal workbook surface a tool may call. The host injects the real client;
 *  it is structurally the LogiSheets `Client` (logisheets-web). */
export interface SkillWorkbook {
    handleTransaction(req: {
        transaction: {
            payloads: readonly unknown[]
            undoable: boolean
            temp: boolean
        }
    }): Promise<unknown>
    getCell(req: {
        sheetIdx: number
        row: number
        col: number
    }): Promise<unknown>
    getAllSheetInfo(): Promise<unknown>
    [method: string]: unknown
}

/** Scoped read/write of THIS craft's persisted state (opaque JSON, same blob as
 *  `window.getCraftState()`/`setCraftState()`). Present only when the host wired
 *  a craftState provider; a tool that uses it should degrade gracefully if absent. */
export interface CraftStateAccess {
    get(): string | undefined
    set(json: string): void
}

/** Context passed to every tool as its first argument. Host-injected; excluded
 *  from the tool's LLM-facing input schema. */
export interface SkillCtx {
    /** The active, permission-scoped workbook client. */
    workbook: SkillWorkbook
    /** Fires if the user cancels the in-flight turn. */
    signal: AbortSignal
    /** Ask the user to confirm; resolves true if approved. */
    confirm: (message: string, detail?: unknown) => Promise<boolean>
    /** Emit a progress / log line into the chat transcript. */
    log: (msg: string) => void
    /** This craft's persisted state, scoped to this craft. Optional. */
    craftState?: CraftStateAccess
}

/* ===========================================================================
 * Runtime authoring (runtime.ts) — the headless "runtime" face of a craft.
 * ===========================================================================
 * A craft's runtime.ts runs WITHOUT a UI. A host (the Node runtime, the
 * collaboration server) reconstructs it from the workbook's saved craft state
 * and calls lifecycle hooks around each JSON-RPC exchange. Author it as a
 * default export:
 *
 *   import type {CraftRuntime} from 'logisheets-craftsmith/authoring'
 *   export default { onLoad, onRequest, onResponse } satisfies CraftRuntime<MyState>
 *
 * These mirror logisheets-core's CraftRuntime (packages/core/src/craft/*) so a
 * craft can depend on craftsmith alone.
 */

/** logisheets-web's error envelope. A hook returns this to signal failure. */
export interface ErrorMessage {
    msg: string
    ty: number
}

/** A hook's outcome: the value on success, or an {@link ErrorMessage}. */
export type Result<T> = T | ErrorMessage

/** A hook may run async engine ops, so it may return a value or a promise. */
export type MaybePromise<T> = T | Promise<T>

/** A craft's persisted state — always a JSON object. Narrow it with your own type. */
export type CraftState = Record<string, unknown>

/** JSON-RPC 2.0 request envelope a runtime sees in `onRequest`. */
export interface JsonRpcRequest {
    jsonrpc: '2.0'
    id?: string | number | null
    method: string
    params?: unknown
}

/** JSON-RPC 2.0 error object. */
export interface JsonRpcError {
    code: number
    message: string
    data?: unknown
}

/** JSON-RPC 2.0 response envelope a runtime sees in `onResponse`. */
export interface JsonRpcResponse {
    jsonrpc: '2.0'
    id: string | number | null
    result?: unknown
    error?: JsonRpcError
}

/** Why a cell failed validation (returned from `onValidate`). */
export type ViolationKind =
    | 'failed'
    | 'error'
    | 'required'
    | 'duplicate'
    | 'membership'

/** One cell that failed its validation rule. */
export interface Violation {
    sheetIdx: number
    row: number
    col: number
    formula?: string
    kind: ViolationKind
    message: string
}

/**
 * The headless logic of a craft. The host reconstructs it from saved state and
 * fires these hooks around a single JSON-RPC exchange, in order:
 *
 *   onLoad      once, when the workbook is opened — rehydrate from state
 *   onRequest   a request's inputs are about to be applied
 *   onValidate  inputs are now in place; check them BEFORE the response is read
 *   onResponse  the response has been produced and is about to be returned
 *
 * `S` is your state shape; `W` is the workbook handle (defaults to the same
 * {@link SkillWorkbook} surface your tools use). Every hook returns a
 * {@link Result}: a plain value / `undefined` on success, or an
 * {@link ErrorMessage} to reject. `onValidate` is optional (omit it if the craft
 * has no validation); a non-empty violation list tells the host to reject the
 * request and roll the inputs back.
 */
export interface CraftRuntime<S extends CraftState = CraftState, W = SkillWorkbook> {
    onLoad: (s: S, wb: W) => MaybePromise<Result<void>>
    onRequest: (req: JsonRpcRequest, s: S, wb: W) => MaybePromise<Result<void>>
    onValidate?: (s: S, wb: W) => MaybePromise<Result<readonly Violation[]>>
    onResponse: (resp: JsonRpcResponse, s: S, wb: W) => MaybePromise<Result<void>>
}
