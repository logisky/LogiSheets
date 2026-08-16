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
