/**
 * DiffLayer Types
 *
 * Type definitions for the spreadsheet diff layer that visualizes
 * uncommitted temp transaction changes.
 */

import type {Value} from 'logisheets-web'

/** The type of change applied to a cell */
export type CellDiffType = 'valueChanged' | 'styleChanged' | 'removed' | 'added'

/** A single cell diff entry, positioned by row/col indices */
export interface CellDiff {
    row: number
    col: number
    type: CellDiffType
    /** Display string for the old value (before temp transaction) */
    oldValue?: string
    /** Display string for the new value (after temp transaction) */
    newValue?: string
}

/** The type of structural change applied to a row or column */
export type LineDiffType = 'inserted' | 'removed' | 'updated'

/** A row diff entry */
export interface RowDiff {
    idx: number
    type: LineDiffType
}

/** A column diff entry */
export interface ColDiff {
    idx: number
    type: LineDiffType
}

/**
 * Complete diff state describing all changes from a temp transaction.
 * Row/col indices are display indices matching the Grid's row/column arrays.
 */
export interface DiffState {
    /** Individual cell changes */
    cells: readonly CellDiff[]
    /** Structural row changes */
    rows: readonly RowDiff[]
    /** Structural column changes */
    cols: readonly ColDiff[]
    /** Whether the diff is currently active (temp transaction applied) */
    active: boolean
}

/** Empty diff state */
export const EMPTY_DIFF: DiffState = {
    cells: [],
    rows: [],
    cols: [],
    active: false,
}

/**
 * Convert a Value to a display string.
 */
export function valueToString(v: Value | undefined): string {
    if (v === undefined || v === 'empty') return ''
    switch (v.type) {
        case 'str':
            return v.value
        case 'number':
            return String(v.value)
        case 'bool':
            return v.value ? 'TRUE' : 'FALSE'
        case 'error':
            return v.value
        default:
            return ''
    }
}

/**
 * Color scheme for the diff layer overlays.
 */
export const DIFF_COLORS = {
    /** Cell value or style changed */
    changed: 'rgba(255, 193, 7, 0.25)',
    changedBorder: 'rgba(255, 193, 7, 0.8)',
    /** New cell / row / column inserted */
    inserted: 'rgba(76, 175, 80, 0.2)',
    insertedBorder: 'rgba(76, 175, 80, 0.8)',
    /** Cell / row / column removed */
    removed: 'rgba(244, 67, 54, 0.2)',
    removedBorder: 'rgba(244, 67, 54, 0.8)',
} as const
