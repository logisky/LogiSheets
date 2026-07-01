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

// Push a craft's serialized state. Called from the iframe-injected
// `setCraftState`; `craftId` is captured per-iframe by the host.
export function setCraftState(craftId: string, json: string): void {
    if (!craftId) return
    craftStates.set(craftId, json)
}

// Read a craft's last-known state (e.g. the one rehydrated from the loaded
// workbook). Returns undefined if the craft never stored anything.
export function getCraftState(craftId: string): string | undefined {
    return craftStates.get(craftId)
}

export function clearCraftState(craftId: string): void {
    craftStates.delete(craftId)
}

// Snapshot every craft's state for persistence into the AppData envelope.
export function getPersistentCraftStates(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [craftId, json] of craftStates) out[craftId] = json
    return out
}

// Rehydrate the store from a previously-persisted snapshot. Replaces the
// current contents so a freshly-loaded workbook doesn't inherit stale state
// from a prior one.
export function loadPersistentCraftStates(data: unknown): void {
    craftStates.clear()
    if (!data || typeof data !== 'object') return
    for (const [craftId, json] of Object.entries(
        data as Record<string, unknown>
    )) {
        if (typeof json === 'string') craftStates.set(craftId, json)
    }
}
