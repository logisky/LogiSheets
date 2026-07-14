import {makeObservable, observable, action} from 'mobx'
import {createContext} from 'react'
import {SelectedData} from 'logisheets-engine'

/**
 * The selection context of whichever view is currently active. The single
 * top edit bar reads/writes through this, so typing a value or formula lands
 * in the view the user last focused (highlighted), not always the main view.
 */
export interface ActiveViewContext {
    selectedData: SelectedData
    /** Active view's current sheet index. */
    sheetIdx: number
    /** Move the active view's selection (e.g. after committing with Enter). */
    setSelection: (d: SelectedData) => void
}

export class GlobalStore {
    constructor() {
        makeObservable(this)
    }

    @observable isTempMode = false

    @action setTempMode(v: boolean) {
        this.isTempMode = v
    }

    // When true, block overlays (border, settings button, field headers,
    // add-row button) are always shown. When false (default), they only
    // appear while the mouse is over the block.
    @observable alwaysShowBlockInfo = false

    @action setAlwaysShowBlockInfo(v: boolean) {
        this.alwaysShowBlockInfo = v
    }

    // When true, a second, independent view of the same workbook is shown
    // side-by-side with the main view (engine.createSession()).
    @observable splitView = false

    @action setSplitView(v: boolean) {
        this.splitView = v
        // Closing the split returns focus to the main view.
        if (!v) this.activeViewId = 'main'
    }

    // Which view currently has focus. With a split view both views can hold
    // selections, so the active one is highlighted to make it obvious where
    // a typed value / formula will land. 'main' is the primary EngineCanvas.
    @observable activeViewId = 'main'

    @action setActiveViewId(id: string) {
        this.activeViewId = id
    }

    // Published by whichever view is active; consumed by the edit bar so it
    // targets that view. observable.ref: replaced wholesale, not mutated.
    @observable.ref activeViewContext: ActiveViewContext | null = null

    @action setActiveViewContext(c: ActiveViewContext | null) {
        this.activeViewContext = c
    }

    // When true (default), the temp-mode diff overlay is rendered. Turning
    // it off hides the overlay without leaving temp mode.
    @observable diffLayerEnabled = true

    @action setDiffLayerEnabled(v: boolean) {
        this.diffLayerEnabled = v
    }

    // When true (default), the engine draws the default cell gridlines. The
    // View toolbar toggle mirrors this to engine.setShowGridLines.
    @observable showGridlines = true

    @action setShowGridlines(v: boolean) {
        this.showGridlines = v
    }

    // When true (default), cell comment indicators are drawn on the grid and
    // their threads can be opened. The View toolbar toggle mirrors this.
    @observable showComments = true

    @action setShowComments(v: boolean) {
        this.showComments = v
    }

    // A one-shot request to open the "new comment" editor on a specific cell,
    // raised by the right-click "Add comment" menu item and consumed by the
    // matching view's CommentLayer. Cleared once handled.
    @observable.ref pendingCommentCell: PendingComment | null = null

    @action requestAddComment(c: PendingComment) {
        // Replace with a fresh object each time so repeated requests on the
        // same cell still re-trigger the editor.
        this.pendingCommentCell = {...c, nonce: (c.nonce ?? 0) + 1}
    }

    @action clearPendingCommentCell() {
        this.pendingCommentCell = null
    }

    // ─── Formula auditing: trace precedents / dependents ────────────────────
    // A one-shot request raised by the right-click "追踪引用/追踪从属" items,
    // fulfilled by TraceLayer (which has workbook access): it calls the engine's
    // get_precedents / get_dependents, then publishes `traceResult` for the
    // overlay to highlight. Mirrors the pendingCommentCell one-shot pattern.
    @observable.ref traceRequest: TraceRequest | null = null

    @action requestTrace(r: Omit<TraceRequest, 'nonce'>) {
        this.traceRequest = {...r, nonce: (this.traceRequest?.nonce ?? 0) + 1}
    }

    // The highlighted result: the origin cell + the cells/ranges it traces to.
    @observable.ref traceResult: TraceResult | null = null

    @action setTraceResult(r: TraceResult | null) {
        this.traceResult = r
        this.traceRequest = null
    }

    @action clearTrace() {
        this.traceResult = null
        this.traceRequest = null
    }
}

export type TraceKind = 'precedents' | 'dependents'

export interface TraceRequest {
    sheetIdx: number
    row: number
    col: number
    kind: TraceKind
    /** Bumped so the same cell can be re-traced. */
    nonce?: number
}

/** A rectangle to highlight (a single cell has start == end). */
export interface TraceRect {
    sheetIdx: number
    startRow: number
    startCol: number
    endRow: number
    endCol: number
}

export interface TraceResult {
    origin: {sheetIdx: number; row: number; col: number}
    kind: TraceKind
    rects: TraceRect[]
}

export interface PendingComment {
    sheetIdx: number
    row: number
    col: number
    /** Bumped so requesting the same cell twice still re-fires the editor. */
    nonce?: number
}

export const globalStore = new GlobalStore()

export const GlobalContext = createContext({})
