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
// The registry is a seam: production wires it to a real HTTP registry, tests
// (and local dev) use {@link MockCraftRegistry}.

import type {CraftManifest, CraftRuntime, CraftState} from 'logisheets-core'
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

/** One craft the loader brought up, with its manifest and live runtime. */
export interface LoadedCraft<S extends CraftState = CraftState> {
    readonly craftId: string
    readonly manifest: CraftManifest
    readonly runtime: NodeCraftRuntime<S>
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

    const result = runtime.onLoad(state, wb)
    if (isErrorMessage(result)) return undefined

    return {craftId, manifest, runtime}
}

/**
 * A default {@link CraftRegistry} for local dev and tests. Crafts are
 * registered in-process against a fake base url; `importRuntime` just returns
 * the pre-registered module so no network or bundler is involved.
 */
export class MockCraftRegistry implements CraftRegistry {
    private readonly entries = new Map<
        string,
        {manifest: CraftManifest; module: unknown}
    >()

    /** Register a craft's manifest and its already-imported runtime module. */
    public add(
        craftId: string,
        manifest: CraftManifest,
        module: unknown
    ): this {
        this.entries.set(craftId, {manifest, module})
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

function isErrorMessage(v: unknown): boolean {
    return (
        typeof v === 'object' &&
        v !== null &&
        'msg' in (v as Record<string, unknown>)
    )
}
