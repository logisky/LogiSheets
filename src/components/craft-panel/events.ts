/**
 * The events the host pushes to a craft page: one hub behind every
 * `window.on<Event>(cb)` the panel injects.
 *
 * Each subscription returns a disposer. Listeners live as long as the craft
 * PAGE, not the panel: the dock only hides a closed panel (the iframe stays
 * mounted), and a craft subscribes once, when its page loads — so the hub is
 * cleared when the panel switches to another craft, never when it closes.
 */

import type {Selection} from 'logisheets-engine'
import type {BlockCellEditEvent} from '@/components/block-interface/edit-bus'

/** Passed to `window.onWorkbookChange` listeners. */
export interface WorkbookChange {
    /**
     * `workbook.getVersion()` after the change, or undefined when it could
     * not be read. Compare it with a version you saved to skip a change you
     * made yourself.
     */
    version?: number
}

export interface CraftHostEventMap {
    selection: Selection
    locale: string
    workbook: WorkbookChange
    blockCellEdit: BlockCellEditEvent
}

export type CraftHostEvent = keyof CraftHostEventMap

type Listener<E extends CraftHostEvent> = (
    payload: CraftHostEventMap[E]
) => void

export interface CraftEventHub {
    subscribe<E extends CraftHostEvent>(
        event: E,
        listener: Listener<E>
    ): () => void
    /** Calls every listener of `event`; one throwing does not stop the rest. */
    emit<E extends CraftHostEvent>(
        event: E,
        payload: CraftHostEventMap[E]
    ): void
    /** Drops every listener: the page that registered them is going away. */
    clear(): void
}

export function createCraftEventHub(): CraftEventHub {
    const listeners = new Map<CraftHostEvent, Set<Listener<never>>>()
    return {
        subscribe(event, listener) {
            let set = listeners.get(event)
            if (!set) {
                set = new Set()
                listeners.set(event, set)
            }
            set.add(listener as Listener<never>)
            return () => {
                listeners.get(event)?.delete(listener as Listener<never>)
            }
        },
        emit(event, payload) {
            // Copy: a listener may unsubscribe (or subscribe) while we iterate.
            for (const l of [...(listeners.get(event) ?? [])]) {
                try {
                    ;(l as Listener<typeof event>)(payload)
                } catch {
                    /* a craft listener throwing must not break the others */
                }
            }
        },
        clear() {
            listeners.clear()
        },
    }
}

/**
 * Turns engine change notifications into one `workbook` event per write.
 *
 * `notify()` is called on every engine `cellChange`; the event fires once
 * after a synchronous burst, with the version read at that point. Changes
 * that land while the version is being read fire one more event, so the last
 * one a craft sees is never older than the workbook.
 *
 * The worker reports one transaction in more than one message (cells, then
 * cells and sheets), so a version already delivered is not delivered again.
 * Every committed write bumps it, undo and redo included.
 */
export function createWorkbookChangeEmitter(
    readVersion: () => Promise<number | undefined>,
    emit: (change: WorkbookChange) => void
): {notify: () => void} {
    let scheduled = false
    let dirty = false
    let last: number | undefined
    const flush = async () => {
        dirty = false
        let version: number | undefined
        try {
            version = await readVersion()
        } catch {
            version = undefined
        }
        if (version === undefined || version !== last) {
            last = version
            emit({version})
        }
        if (dirty) await flush()
        else scheduled = false
    }
    return {
        notify() {
            dirty = true
            if (scheduled) return
            scheduled = true
            queueMicrotask(() => void flush())
        },
    }
}
