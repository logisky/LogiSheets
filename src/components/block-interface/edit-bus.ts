// Host-side bus that fires whenever the user commits a value through one
// of the interactive block-interface widgets (bool / enum / datetime /
// fieldRef / multiSelectRef). Crafts subscribe via
// `window.onBlockCellEdit` to react to user choices without instrumenting
// the engine's depgraph.

export interface BlockCellEditEvent {
    sheetIdx: number
    rowIdx: number
    colIdx: number
    sheetId: number
    blockId: number
    fieldId: string
    fieldName: string
    /**
     * Block schema ref name (BLOCKREF first argument). Present iff the
     * block's schema has been bound and `FieldManager.setBlockRefName`
     * was called — the host stamps it on at `bindFormSchema` time.
     */
    refName?: string
    /**
     * Raw string committed via CellInputBuilder — `"1"` / `"0"` for
     * booleans, the option key for enums, formatted text for datetimes,
     * comma-joined value list for multiSelectRef, etc. Listeners that
     * care about the typed value should reread it via the workbook API.
     */
    newValue: string
}

export type BlockCellEditListener = (event: BlockCellEditEvent) => void

const listeners = new Set<BlockCellEditListener>()

export const blockEditBus = {
    /** Fire an event to every listener. Called from each widget's commit path. */
    emit(event: BlockCellEditEvent): void {
        listeners.forEach((l) => l(event))
    },
    /**
     * Subscribe. Returns a disposer; call it to unsubscribe.
     * Listeners run synchronously in registration order — keep them cheap.
     */
    on(listener: BlockCellEditListener): () => void {
        listeners.add(listener)
        return () => {
            listeners.delete(listener)
        }
    },
}
