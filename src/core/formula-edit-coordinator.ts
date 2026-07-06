/**
 * Cross-view formula-edit coordinator.
 *
 * Tracks the single in-progress formula edit (Excel "point mode") across every
 * view/session so that:
 *  - any view's cell click routes a reference to the active editor instead of
 *    committing (see the inline editor's onSelectionChange),
 *  - sheet tabs and other canvases know not to steal focus while it's open,
 *  - a floating reminder can show the target cell + live formula when the user
 *    has navigated away from the edited cell's sheet/view.
 *
 * The concrete instance is MobX-observable (via `snapshot`) so the reminder
 * re-renders; the imperative getters (`getActive`/`isFormulaEditing`) are read
 * outside React by the engine's focus guards and the sheet tabs.
 */
import {makeObservable, observable, action} from 'mobx'
import type {
    FormulaCoordinator,
    FormulaEditEntry,
} from 'logisheets-formula-editor/inline'

/** Observable snapshot of the active edit, consumed by the reminder UI. */
export interface FormulaEditSnapshot {
    viewId: string
    editSheetIdx: number
    /** Display reference of the edited cell, e.g. "Sheet1!B2". */
    cellRef: string
    /** Live formula text. */
    text: string
}

class FormulaEditCoordinatorImpl implements FormulaCoordinator {
    // The live entry (plain, non-observable — used for imperative routing).
    private _active: FormulaEditEntry | null = null

    // Observable mirror for the reminder component.
    @observable.ref snapshot: FormulaEditSnapshot | null = null

    constructor() {
        makeObservable(this)
    }

    @action setActive(entry: FormulaEditEntry) {
        this._active = entry
        this._sync(entry)
    }

    @action clear(entry: FormulaEditEntry) {
        if (this._active === entry) {
            this._active = null
            this.snapshot = null
        }
    }

    @action notifyChange(entry: FormulaEditEntry) {
        if (this._active === entry) this._sync(entry)
    }

    private _sync(entry: FormulaEditEntry) {
        this.snapshot = {
            viewId: entry.viewId,
            editSheetIdx: entry.getEditSheetIdx(),
            cellRef: entry.getCellRef(),
            text: entry.getText(),
        }
    }

    getActive(): FormulaEditEntry | null {
        return this._active
    }

    isFormulaEditing(): boolean {
        return this._active !== null
    }

    /** Refocus the active editor (e.g. after a sheet tab took focus) so Enter
     *  keeps committing. */
    focusActive() {
        this._active?.focus()
    }

    /** Confirm the active edit (for the reminder's button). */
    commitActive() {
        this._active?.commit()
    }

    /** Cancel the active edit (for the reminder's button). */
    cancelActive() {
        this._active?.cancel()
    }
}

export const formulaEditCoordinator = new FormulaEditCoordinatorImpl()
