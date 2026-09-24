/**
 * logisheets-formula-editor/engine
 *
 * One-call binding from a logisheets engine `DataService` (or anything with
 * the same methods) to the props the editor needs — so the host doesn't
 * re-implement the `getDisplayUnits` / `checkFormula` / function-list wiring by
 * hand for every editor instance.
 *
 *   import { createFormulaEditor } from 'logisheets-formula-editor/core'
 *   import { createEngineFormulaSource } from 'logisheets-formula-editor/engine'
 *
 *   const src = createEngineFormulaSource(engine.getDataService())
 *   createFormulaEditor(el, { ...src, sheetName, onSubmit, ... })
 *
 * Typed structurally (no `logisheets-web` import), so it stays dependency-free
 * and accepts any object exposing the methods below. The engine's
 * `DataService` (logisheets-engine) satisfies it as-is.
 *
 * Main export: `createEngineFormulaSource`. Consumers: the root app's edit bar
 * and the `/inline` in-cell controller (which also uses the point-mode
 * navigation methods on `FormulaWorkbook`).
 */

import type {
    CellRef,
    FormulaDisplayInfo,
    FormulaFunction,
    GetDisplayUnitsFunc,
} from './types'
import {builtinFormulaFunctions} from './functions'

/**
 * The slice of a workbook client the source needs. Only
 * `getDisplayUnitsOfFormula` is used by {@link createEngineFormulaSource}; the
 * two navigation methods are for the `/inline` controller's point mode. All
 * indices are 0-based.
 */
export interface FormulaWorkbook {
    /**
     * Lex a formula body (no leading '='). Resolves to a
     * {@link FormulaDisplayInfo} on success or an error-message object
     * otherwise; the source tells them apart by the `tokenUnits` key.
     */
    getDisplayUnitsOfFormula(formula: string): Promise<unknown>
    /**
     * Point-mode arrow move: the next visible cell in a direction (skips hidden
     * rows/cols). Resolves to a `{x: col, y: row}` coordinate, or an
     * error-message-like object when there's nowhere to go. Structural on
     * purpose — the concrete client is logisheets-web's `Workbook`.
     */
    getNextVisibleCell(params: {
        sheetIdx: number
        rowIdx: number
        colIdx: number
        direction: 'up' | 'down' | 'left' | 'right'
    }): Promise<unknown>
    /** Ctrl+Arrow: jump to the next data / block boundary (same shape). */
    getDataBoundary(params: {
        sheetIdx: number
        rowIdx: number
        colIdx: number
        direction: 'up' | 'down' | 'left' | 'right'
    }): Promise<unknown>
}

/** The slice of an engine `DataService` the source needs. */
export interface EngineFormulaServices {
    /** Called per request, not cached, so a swapped workbook is picked up. */
    getWorkbook(): FormulaWorkbook
    /**
     * Whether a formula (text as typed, including the leading '=') parses.
     * Expected to resolve `false` rather than reject on an engine error.
     */
    checkFormula(formula: string): Promise<boolean>
    /**
     * Sheet name for a 0-based sheet index — used by `/inline` to qualify
     * cross-sheet references. Not used by {@link createEngineFormulaSource}.
     */
    getSheetNameByIdx(idx: number): string
}

export interface EngineFormulaSourceOptions {
    /**
     * Functions for autocomplete + signature help. Defaults to the bundled
     * {@link builtinFormulaFunctions}; pass a localized list to override.
     */
    formulaFunctions?: FormulaFunction[]
    /**
     * Called with the parsed cell references each time display units are
     * fetched — wire this to your reference-highlight overlay.
     */
    onCellRefs?: (cellRefs: readonly CellRef[]) => void
}

/**
 * Props derived from the engine. The editor itself consumes
 * `getDisplayUnits` + `formulaFunctions`; `checkFormula` is for the host's
 * commit path — the editor never validates on its own.
 */
export interface EngineFormulaSource {
    getDisplayUnits: GetDisplayUnitsFunc
    checkFormula: (formula: string) => Promise<boolean>
    formulaFunctions: FormulaFunction[]
}

/**
 * Build the editor's data props from an engine `DataService`. Spread the result
 * into `createFormulaEditor` / `<FormulaEditor>`.
 *
 * The returned `getDisplayUnits` never rejects: an engine error, a thrown
 * call, or an unlexable formula all resolve `undefined` (no highlighting) and report
 * an empty ref list to `onCellRefs`, so an overlay clears instead of showing
 * stale highlights. `checkFormula` is passed through unchanged. Holds no
 * resources — nothing to dispose.
 */
export function createEngineFormulaSource(
    services: EngineFormulaServices,
    options: EngineFormulaSourceOptions = {}
): EngineFormulaSource {
    const formulaFunctions = options.formulaFunctions ?? builtinFormulaFunctions

    const getDisplayUnits: GetDisplayUnitsFunc = async (formula) => {
        try {
            const result = await services
                .getWorkbook()
                .getDisplayUnitsOfFormula(formula)
            // Success shape carries tokenUnits; anything else is an ErrorMessage.
            if (
                result &&
                typeof result === 'object' &&
                'tokenUnits' in result
            ) {
                const info = result as FormulaDisplayInfo
                options.onCellRefs?.(info.cellRefs)
                return info
            }
        } catch {
            // fall through to the empty/undefined result below
        }
        options.onCellRefs?.([])
        return undefined
    }

    return {
        getDisplayUnits,
        checkFormula: (formula) => services.checkFormula(formula),
        formulaFunctions,
    }
}
