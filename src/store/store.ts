import {makeObservable, observable, observableRef, action} from 'mobx'
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
        makeObservable(this, {
            isTempMode: observable,
            llmSetupRequests: observable,
            alwaysShowBlockInfo: observable,
            splitView: observable,
            activeViewId: observable,
            activeViewContext: observableRef,
            diffLayerEnabled: observable,
            showGridlines: observable,
            showComments: observable,
            pendingCommentCell: observableRef,
            findRequest: observable,
            traceRequest: observableRef,
            traceResult: observableRef,
            linkRevision: observable,
            setTempMode: action,
            requestLlmSetup: action,
            setAlwaysShowBlockInfo: action,
            setSplitView: action,
            setActiveViewId: action,
            setActiveViewContext: action,
            setDiffLayerEnabled: action,
            setShowGridlines: action,
            setShowComments: action,
            requestAddComment: action,
            clearPendingCommentCell: action,
            requestFind: action,
            requestTrace: action,
            setTraceResult: action,
            clearTrace: action,
            bumpLinkRevision: action,
        })
    }

    isTempMode = false

    setTempMode(v: boolean) {
        this.isTempMode = v
    }

    // Bumped when something asks the host to open LLM setup — a craft whose
    // AI features are dark because no key is configured, for instance.
    //
    // A counter rather than a boolean: two asks in a row should open the
    // panel twice, and a boolean that is already true is indistinguishable
    // from one nobody reset. Nothing here knows what a key IS; a craft must
    // never see one. It can only ask the host to show its own settings.
    llmSetupRequests = 0

    requestLlmSetup() {
        this.llmSetupRequests += 1
    }

    // When true, block overlays (border, settings button, field headers,
    // add-row button) are always shown. When false (default), they only
    // appear while the mouse is over the block.
    alwaysShowBlockInfo = false

    setAlwaysShowBlockInfo(v: boolean) {
        this.alwaysShowBlockInfo = v
    }

    // When true, a second, independent view of the same workbook is shown
    // side-by-side with the main view (engine.createSession()).
    splitView = false

    setSplitView(v: boolean) {
        this.splitView = v
        // Closing the split returns focus to the main view.
        if (!v) this.activeViewId = 'main'
    }

    // Which view currently has focus. With a split view both views can hold
    // selections, so the active one is highlighted to make it obvious where
    // a typed value / formula will land. 'main' is the primary EngineCanvas.
    activeViewId = 'main'

    setActiveViewId(id: string) {
        this.activeViewId = id
    }

    // Published by whichever view is active; consumed by the edit bar so it
    // targets that view. observableRef: replaced wholesale, not mutated.
    activeViewContext: ActiveViewContext | null = null

    setActiveViewContext(c: ActiveViewContext | null) {
        this.activeViewContext = c
    }

    // When true (default), the temp-mode diff overlay is rendered. Turning
    // it off hides the overlay without leaving temp mode.
    diffLayerEnabled = true

    setDiffLayerEnabled(v: boolean) {
        this.diffLayerEnabled = v
    }

    // When true (default), the engine draws the default cell gridlines. The
    // View toolbar toggle mirrors this to engine.setShowGridLines.
    showGridlines = true

    setShowGridlines(v: boolean) {
        this.showGridlines = v
    }

    // When true (default), cell comment indicators are drawn on the grid and
    // their threads can be opened. The View toolbar toggle mirrors this.
    showComments = true

    setShowComments(v: boolean) {
        this.showComments = v
    }

    // A one-shot request to open the "new comment" editor on a specific cell,
    // raised by the right-click "Add comment" menu item and consumed by the
    // matching view's CommentLayer. Cleared once handled.
    pendingCommentCell: PendingComment | null = null

    requestAddComment(c: PendingComment) {
        // Replace with a fresh object each time so repeated requests on the
        // same cell still re-trigger the editor.
        this.pendingCommentCell = {...c, nonce: (c.nonce ?? 0) + 1}
    }

    clearPendingCommentCell() {
        this.pendingCommentCell = null
    }

    // A one-shot request to open the find/replace overlay, raised by the
    // toolbar's Find button and consumed by EngineCanvas (which owns the
    // dialog). The engine's own Ctrl+F path emits a `find` event instead; both
    // end at the same state. A counter rather than a boolean so a second click
    // re-opens it after the user closed it.
    findRequest = 0

    requestFind() {
        this.findRequest += 1
    }

    // ─── Formula auditing: trace precedents / dependents ────────────────────
    // A one-shot request raised by the right-click "Trace precedents" and
    // "Trace dependents" items,
    // fulfilled by TraceLayer (which has workbook access): it calls the engine's
    // get_precedents / get_dependents, then publishes `traceResult` for the
    // overlay to highlight. Mirrors the pendingCommentCell one-shot pattern.
    traceRequest: TraceRequest | null = null

    requestTrace(r: Omit<TraceRequest, 'nonce'>) {
        this.traceRequest = {...r, nonce: (this.traceRequest?.nonce ?? 0) + 1}
    }

    // The highlighted result: the origin cell + the cells/ranges it traces to.
    traceResult: TraceResult | null = null

    setTraceResult(r: TraceResult | null) {
        this.traceResult = r
        this.traceRequest = null
    }

    clearTrace() {
        this.traceResult = null
        this.traceRequest = null
    }

    // ─── Range→block links ──────────────────────────────────────────────────
    // Bumped whenever a link is created/removed so LinkLayer refetches and draws
    // the outer border immediately. Linking an empty range changes no cell
    // value, so the normal gridChange/cellUpdated signals don't fire — this is
    // the explicit nudge for that case.
    linkRevision = 0

    bumpLinkRevision() {
        this.linkRevision += 1
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
