/**
 * logisheets-formula-editor/engine
 *
 * One-call binding from a logisheets engine `DataService` (or anything with
 * the same two methods) to the props the editor needs — so the host doesn't
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
 * and accepts any object exposing the two methods below.
 */

import type {
    CellRef,
    FormulaDisplayInfo,
    FormulaFunction,
    GetDisplayUnitsFunc,
} from './types'
import {builtinFormulaFunctions} from './functions'

/** The slice of a workbook client the source needs. */
export interface FormulaWorkbook {
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
    getWorkbook(): FormulaWorkbook
    checkFormula(formula: string): Promise<boolean>
    /** Sheet name for a given index — used to build cross-sheet references. */
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

/** Props the editor consumes, derived from the engine. */
export interface EngineFormulaSource {
    getDisplayUnits: GetDisplayUnitsFunc
    checkFormula: (formula: string) => Promise<boolean>
    formulaFunctions: FormulaFunction[]
}

/**
 * Build the editor's data props from an engine `DataService`. Spread the result
 * into `createFormulaEditor` / `<FormulaEditor>`.
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
