// Host-held store of opaque per-craft JSON state.
//
// A craft (running in its iframe) pushes its own serialized state here via the
// injected `setCraftState(json)` API, keyed by the craft's id (its iframe src
// path — stable across sessions). On file save the host folds the whole store
// into the AppData envelope under `craftStates`; on load it is rehydrated, so a
// craft can read its previous state back via `getCraftState()` the next time
// its iframe mounts.
//
// The host treats each entry as an opaque string and never parses it — the
// craft owns its own schema. This state lives entirely outside the engine's
// undo/redo Status (it rides AppData, a side channel on the workbook), so
// writing it never pollutes edit history.

const craftStates = new Map<string, string>()

/** Push a craft's serialized state (replaces the previous one). Called from
 *  the iframe-injected `setCraftState`; `craftId` is captured per-iframe by
 *  the host. An empty `craftId` is ignored. Not written to the engine until
 *  the host next saves the file. */
export function setCraftState(craftId: string, json: string): void {
    if (!craftId) return
    craftStates.set(craftId, json)
}

/** A craft's last-known state (e.g. the one rehydrated from the loaded
 *  workbook), or undefined if the craft never stored anything. */
export function getCraftState(craftId: string): string | undefined {
    return craftStates.get(craftId)
}

/** Forget a craft's state; the next save omits it. */
export function clearCraftState(craftId: string): void {
    craftStates.delete(craftId)
}

/** Snapshot every craft's state, for the host to fold into the AppData
 *  envelope's `craftStates` on save. */
export function getPersistentCraftStates(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [craftId, json] of craftStates) out[craftId] = json
    return out
}

/** Rehydrate from a previously-persisted snapshot. Replaces the current
 *  contents, so a freshly-loaded workbook doesn't inherit state from a prior
 *  one; non-string entries are dropped. Pass `undefined` to reset. */
export function loadPersistentCraftStates(data: unknown): void {
    craftStates.clear()
    if (!data || typeof data !== 'object') return
    for (const [craftId, json] of Object.entries(
        data as Record<string, unknown>
    )) {
        if (typeof json === 'string') craftStates.set(craftId, json)
    }
}
