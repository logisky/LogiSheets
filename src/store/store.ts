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
}

export const globalStore = new GlobalStore()

export const GlobalContext = createContext({})
