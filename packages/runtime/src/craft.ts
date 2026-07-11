// Craft loading for the headless runtime.
//
// A workbook can carry per-craft state in its AppData side channel (see
// logisheets-core's craft/state.ts). When such state is present it signals that
// the workbook depends on one or more crafts. This module reconstructs those
// crafts on the runtime side so their logic runs headlessly:
//
//   1. read the workbook's AppData and pull out the `craftStates` map
//      (craftId -> opaque serialized state) folded in by the host on save,
//   2. for every craft id found, ask the {@link CraftRegistry} for its
//      {@link CraftManifest},
//   3. if the manifest names a runtime JS file, download + import it — the
//      imported module *is* the craft's {@link CraftRuntime},
//   4. call the runtime's `onLoad(state, workbook)` so it can rehydrate.
//
// The registry is a seam: production may wire it to a real HTTP registry;
// embedding hosts, local dev, and tests use the in-process {@link
// MemoryCraftRegistry}.

import type {
    CraftManifest,
    CraftRuntime,
    CraftState,
    Violation,
    JsonRpcRequest,
    JsonRpcResponse,
} from 'logisheets-core'
import type {Workbook} from './index.js'

/**
 * A {@link CraftRuntime} bound to this runtime's {@link Workbook} — the shape a
 * Node craft implements. logisheets-core keeps the workbook type generic; here
 * we pin it to the concrete runtime workbook.
 */
export type NodeCraftRuntime<S extends CraftState = CraftState> = CraftRuntime<
    S,
    Workbook
>

/**
 * The name of the AppData entry the host folds craft/block/interaction state
 * into. Mirrors the envelope written by the browser host on save.
 */
const APP_DATA_ENVELOPE_NAME = 'logisheets'

/**
 * Resolves craft ids to their code. This is the only part that talks to the
 * outside world (an HTTP registry, a filesystem, a test double), so the loader
 * stays environment-agnostic.
 */
export interface CraftRegistry {
    /**
     * Look up a craft's manifest by its stable id. Returns `undefined` when the
     * registry has no such craft (the loader then skips it).
     */
    getManifest(craftId: string): Promise<CraftManifest | undefined>

    /**
     * Download and import a craft's runtime module. `manifest.rtJs` is the path
     * of the runtime JS file; implementations fetch it and `import()` the
     * result. Returns the imported module namespace (the loader extracts the
     * {@link CraftRuntime} from it), or `undefined` when the craft ships no
     * runtime (`rtJs` empty) or the import yields nothing.
     */
    importRuntime(
        craftId: string,
        manifest: CraftManifest
    ): Promise<unknown | undefined>
}

/** One craft the loader brought up, with its manifest, live runtime, and the
 * parsed state it was loaded with (kept so the request/validate/response hooks
 * can be re-invoked with the same state per RPC exchange). */
export interface LoadedCraft<S extends CraftState = CraftState> {
    readonly craftId: string
    readonly manifest: CraftManifest
    readonly runtime: NodeCraftRuntime<S>
    readonly state: S
}

/**
 * Read a workbook's AppData and return the `craftStates` map it carries
 * (craftId -> opaque serialized state), or an empty object when there is none.
 *
 * The state string is left opaque exactly as the craft wrote it — parsing is
 * the craft's business (see {@link loadCrafts}, which hands it to `onLoad`).
 */
export async function readCraftStates(
    wb: Workbook
): Promise<Record<string, string>> {
    const appData = await wb.client.getAppData()
    if (!Array.isArray(appData)) return {}

    const entry = appData.find(
        (d): d is {name: string; data: string} =>
            !!d &&
            typeof (d as {name?: unknown}).name === 'string' &&
            (d as {name: string}).name === APP_DATA_ENVELOPE_NAME
    )
    if (!entry) return {}

    let envelope: {craftStates?: unknown}
    try {
        envelope = JSON.parse(entry.data)
    } catch {
        // Legacy (raw BlockManager) payload — no craft states.
        return {}
    }

    const raw = envelope?.craftStates
    if (!raw || typeof raw !== 'object') return {}

    const out: Record<string, string> = {}
    for (const [craftId, state] of Object.entries(
        raw as Record<string, unknown>
    )) {
        if (typeof state === 'string') out[craftId] = state
    }
    return out
}

/**
 * Bring up every craft a workbook depends on and hand each its saved state.
 *
 * For each craft id found in the workbook's AppData: resolve its manifest,
 * download + import its runtime, then call `runtime.onLoad(state, wb)`. A craft
 * that has no manifest, ships no runtime, or throws while loading is skipped —
 * one broken craft never blocks the rest. Returns the crafts that loaded.
 */
export async function loadCrafts(
    wb: Workbook,
    registry: CraftRegistry
): Promise<LoadedCraft[]> {
    const states = await readCraftStates(wb)
    const craftIds = Object.keys(states)
    if (craftIds.length === 0) return []

    const loaded: LoadedCraft[] = []
    for (const craftId of craftIds) {
        // Deliberately sequential: crafts may touch shared workbook state in
        // onLoad, so we don't race them. Revisit if that proves too slow.
        // eslint-disable-next-line no-await-in-loop
        const craft = await loadOneCraft(wb, registry, craftId, states[craftId])
        if (craft) loaded.push(craft)
    }
    return loaded
}

async function loadOneCraft(
    wb: Workbook,
    registry: CraftRegistry,
    craftId: string,
    stateJson: string
): Promise<LoadedCraft | undefined> {
    const manifest = await registry.getManifest(craftId)
    if (!manifest) return undefined

    // No runtime file -> nothing to run for this craft (it may be UI-only).
    if (!manifest.rtJs) return undefined

    const mod = await registry.importRuntime(craftId, manifest)
    const runtime = asCraftRuntime(mod)
    if (!runtime) return undefined

    const state = parseState(stateJson)
    if (!state) return undefined

    // onLoad may run engine operations (async on every host), so await it.
    const result = await runtime.onLoad(state, wb)
    if (isErrorMessage(result)) return undefined

    return {craftId, manifest, runtime, state}
}

/**
 * Notify every loaded craft that an RPC request's inputs are about to be
 * applied, and collect any objections. A craft signals "reject this request"
 * by returning an ErrorMessage (or throwing) from `onRequest` — e.g. the
 * data-gateway craft rejects a request that names a block it isn't allowed to
 * write. Returns the objection messages (empty when every craft is fine); a
 * host that gets a non-empty result should reject the request before applying
 * it.
 */
export async function applyCraftRequest(
    loaded: readonly LoadedCraft[],
    req: JsonRpcRequest,
    wb: Workbook
): Promise<string[]> {
    const errors: string[] = []
    for (const craft of loaded) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const res = await craft.runtime.onRequest(req, craft.state, wb)
            if (isErrorMessage(res)) errors.push(res.msg)
        } catch (e) {
            errors.push(e instanceof Error ? e.message : String(e))
        }
    }
    return errors
}

/**
 * The validation checkpoint: run every loaded craft's `onValidate` now that
 * the request's inputs are in place, and return the union of the cells that
 * fail their rules. An empty result means every craft is satisfied and the
 * host may proceed to read the response; a non-empty result means the host
 * should reject the request and roll the inputs back. Crafts with no
 * `onValidate` contribute nothing; a craft that errors is treated as
 * contributing no violations (its objection, if any, surfaced in onRequest).
 */
export async function validateLoadedCrafts(
    loaded: readonly LoadedCraft[],
    wb: Workbook
): Promise<Violation[]> {
    const violations: Violation[] = []
    for (const craft of loaded) {
        if (!craft.runtime.onValidate) continue
        // eslint-disable-next-line no-await-in-loop
        const res = await craft.runtime.onValidate(craft.state, wb)
        if (isErrorMessage(res)) continue
        violations.push(...res)
    }
    return violations
}

/**
 * Hand every loaded craft the RPC response about to be returned (e.g. so a
 * craft can read its output blocks back). Returns any objection messages, same
 * contract as {@link applyCraftRequest}.
 */
export async function applyCraftResponse(
    loaded: readonly LoadedCraft[],
    resp: JsonRpcResponse,
    wb: Workbook
): Promise<string[]> {
    const errors: string[] = []
    for (const craft of loaded) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const res = await craft.runtime.onResponse(resp, craft.state, wb)
            if (isErrorMessage(res)) errors.push(res.msg)
        } catch (e) {
            errors.push(e instanceof Error ? e.message : String(e))
        }
    }
    return errors
}

// JSON-RPC 2.0 error codes (kept local so this pure-logic module doesn't pull
// in the HTTP server that also owns them).
const RPC_INVALID_PARAMS = -32602
const RPC_INTERNAL_ERROR = -32603
/** Application code: a craft's `onValidate` rejected the request's inputs. */
export const RPC_VALIDATION_FAILED = 1001

function errorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
): JsonRpcResponse {
    return {
        jsonrpc: '2.0',
        id,
        error: data === undefined ? {code, message} : {code, message, data},
    }
}

/**
 * Run one JSON-RPC exchange against a workbook's loaded crafts and return the
 * reply. This is the generic "run a craft's request/response" primitive — a
 * host registers it as an RPC method (or task handler) and never re-implements
 * the exchange. Composes the three hooks in order:
 *
 *   1. {@link applyCraftRequest}   — write the request's inputs (`#INVALID_PARAMS` if a craft rejects one),
 *   2. {@link validateLoadedCrafts} — validate them (`#VALIDATION_FAILED` + the violations if any fail),
 *   3. {@link applyCraftResponse}  — read the outputs into `result` (`#INTERNAL_ERROR` if a craft errors).
 *
 * The crafts define what the exchange does (via their onRequest/onResponse);
 * this function is entirely craft-agnostic.
 */
export async function runCraftExchange(
    loaded: readonly LoadedCraft[],
    wb: Workbook,
    req: JsonRpcRequest
): Promise<JsonRpcResponse> {
    const id = req.id ?? null

    const reqErrors = await applyCraftRequest(loaded, req, wb)
    if (reqErrors.length)
        return errorResponse(id, RPC_INVALID_PARAMS, reqErrors.join('; '))

    const violations = await validateLoadedCrafts(loaded, wb)
    if (violations.length)
        return errorResponse(id, RPC_VALIDATION_FAILED, 'validation failed', violations)

    const resp: JsonRpcResponse = {jsonrpc: '2.0', id}
    const respErrors = await applyCraftResponse(loaded, resp, wb)
    if (respErrors.length)
        return errorResponse(id, RPC_INTERNAL_ERROR, respErrors.join('; '))

    return resp
}

/**
 * An in-memory {@link CraftRegistry}: crafts are registered in-process with
 * their already-imported runtime module, so `importRuntime` returns it directly
 * — no network, bundler, or filesystem. This is the general-purpose registry
 * for a host that knows its crafts up front (embedding, local dev, tests);
 * production may instead back the registry with a real HTTP registry.
 */
export class MemoryCraftRegistry implements CraftRegistry {
    private readonly entries = new Map<
        string,
        {manifest: CraftManifest; module: unknown}
    >()

    /**
     * Register a craft by id with its runtime module (a {@link CraftRuntime},
     * or a module whose default export is one). `manifest` is optional
     * metadata; the default carries a non-empty `rtJs` so {@link loadCrafts}
     * imports the module instead of skipping the craft as runtime-less.
     */
    public add(craftId: string, module: unknown, manifest?: CraftManifest): this {
        this.entries.set(craftId, {
            manifest: manifest ?? {rtJs: craftId, html: ''},
            module,
        })
        return this
    }

    public getManifest(craftId: string): Promise<CraftManifest | undefined> {
        return Promise.resolve(this.entries.get(craftId)?.manifest)
    }

    public importRuntime(craftId: string): Promise<unknown | undefined> {
        return Promise.resolve(this.entries.get(craftId)?.module)
    }
}

// The runtime may be the module's default export or the module itself.
function asCraftRuntime(mod: unknown): NodeCraftRuntime | undefined {
    const candidate =
        mod && typeof mod === 'object' && 'default' in mod
            ? (mod as {default: unknown}).default
            : mod
    if (
        candidate &&
        typeof (candidate as {onLoad?: unknown}).onLoad === 'function'
    ) {
        return candidate as NodeCraftRuntime
    }
    return undefined
}

// Craft state is stored as an opaque string but is always a serialized JSON
// object. Parse it back; return undefined if it isn't a JSON object (a
// malformed entry we skip rather than hand a craft a bad shape).
function parseState(stateJson: string): CraftState | undefined {
    let parsed: unknown
    try {
        parsed = JSON.parse(stateJson)
    } catch {
        return undefined
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return undefined
    }
    return parsed as CraftState
}

function isErrorMessage(v: unknown): v is {msg: string} {
    return (
        typeof v === 'object' &&
        v !== null &&
        'msg' in (v as Record<string, unknown>)
    )
}
