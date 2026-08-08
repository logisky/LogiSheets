// Canvas input routing for the ACTIVE craft.
//
// When a craft is active (its panel is open and it is the selected craft), the
// host lets it see mouse/keyboard events happening on the spreadsheet canvas
// BEFORE the engine does, and the craft decides — synchronously — whether the
// engine should still handle each one. This is the seam that lets a craft
// implement its own canvas tool (custom selection, drawing, drag gestures)
// without forking the engine.
//
// The craft registers a handler through the injected `window.onCanvasInput`
// (see the craft panel). The host (the per-view interceptor) calls
// `dispatchCraftCanvasEvent` from a capture-phase DOM listener; if the active
// craft's handler returns "handled", the host stops the event from reaching
// the engine. The call is synchronous end-to-end — the iframe is same-origin,
// so there is no postMessage hop — which is what makes a real pass-through
// decision possible mid-dispatch.

/** The kinds of canvas events forwarded to a craft. */
export type CraftCanvasEventType =
    | 'mousedown'
    | 'mousemove'
    | 'mouseup'
    | 'click'
    | 'dblclick'
    | 'contextmenu'
    | 'wheel'
    | 'keydown'
    | 'keyup'

/**
 * A serialized, realm-safe snapshot of a canvas DOM event, plus the resolved
 * cell under the pointer. Passed to the craft's handler. It is a plain object
 * (not the live DOM event) so it crosses the iframe boundary cleanly; the craft
 * cannot mutate host event state — it only returns a decision.
 */
export interface CraftCanvasEvent {
    type: CraftCanvasEventType
    /** Viewport coordinates (mouse/wheel only; 0 for keyboard). */
    clientX: number
    clientY: number
    /** Coordinates relative to the data canvas's top-left (mouse/wheel only). */
    offsetX: number
    offsetY: number
    /** Which view the event came from ('main' or a secondary view id). */
    viewId: string
    /** The sheet shown in that view. */
    sheetIdx: number
    /** Cell under the pointer, or null when outside the data area / keyboard. */
    row: number | null
    col: number | null
    // Mouse
    button: number
    buttons: number
    // Wheel
    deltaX: number
    deltaY: number
    // Keyboard
    key: string
    code: string
    // Modifiers (all event kinds)
    altKey: boolean
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    /** True when the event repeats (held key). */
    repeat: boolean
}

/**
 * What a craft returns from its handler. `true` (or `{handled: true}`) tells
 * the host to consume the event — the engine never sees it. `false`, `void`, or
 * `{handled: false}` lets it pass through to the engine unchanged.
 */
export type CraftInputDecision = boolean | {handled: boolean} | void

export type CraftInputHandler = (e: CraftCanvasEvent) => CraftInputDecision

// Which craft is active right now (panel open + selected). null = none, so the
// interceptor is a no-op and the engine behaves normally.
let activeCraftId: string | null = null

// Per-craft handlers. A craft's handler stays registered while its iframe is
// alive; only the active craft's handler is ever invoked.
const handlers = new Map<string, CraftInputHandler>()

/** Host: mark the active craft (its id, i.e. its iframe src), or null. */
export function setActiveCraft(craftId: string | null): void {
    activeCraftId = craftId
}

/** The currently-active craft id, or null. */
export function getActiveCraft(): string | null {
    return activeCraftId
}

/**
 * Craft (via injection): register a canvas-input handler. Returns a disposer.
 * Re-registering replaces the previous handler for that craft.
 */
export function registerCraftInputHandler(
    craftId: string,
    handler: CraftInputHandler
): () => void {
    handlers.set(craftId, handler)
    return () => {
        if (handlers.get(craftId) === handler) handlers.delete(craftId)
    }
}

/**
 * Whether an active craft has a handler ready. The interceptor checks this
 * first so it does no work (no event serialization) unless a craft is actually
 * listening — important since this runs on every mousemove.
 */
export function hasActiveCraftInputHandler(): boolean {
    return activeCraftId !== null && handlers.has(activeCraftId)
}

/**
 * Host: deliver an event to the active craft and get its decision. Never
 * throws — a craft handler that throws is treated as "not handled" so a buggy
 * craft can't wedge the spreadsheet.
 */
export function dispatchCraftCanvasEvent(evt: CraftCanvasEvent): {
    handled: boolean
} {
    if (activeCraftId === null) return {handled: false}
    const handler = handlers.get(activeCraftId)
    if (!handler) return {handled: false}
    try {
        const r = handler(evt)
        const handled =
            r === true || (typeof r === 'object' && r !== null && r.handled === true)
        return {handled}
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[craft-events] handler threw', e)
        return {handled: false}
    }
}
