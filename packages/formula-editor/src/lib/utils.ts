/**
 * Utility functions for the Formula Editor
 */

import type {TokenType, FormulaDisplayInfo, CellRef} from './types'

/**
 * Special character used to represent line breaks in the editor.
 */
export const EOF = '\n'

/**
 * Display unit for rendering - combines token info with content.
 */
export interface DisplayUnit {
    content: string
    type: TokenType | 'eof' | 'plain'
}

/**
 * Convert formula display info to display units for rendering.
 * The offset accounts for the leading '=' being stripped before sending to backend.
 *
 * @param formula - The full formula string (including leading '=')
 * @param displayInfo - Token info from backend
 * @returns Array of display units for rendering
 */
export function convertToDisplayUnits(
    formula: string,
    displayInfo: FormulaDisplayInfo
): DisplayUnit[] {
    const offset = 1 // Account for leading '='
    const units: DisplayUnit[] = []
    let stringIdx = 0

    for (const tokenUnit of displayInfo.tokenUnits) {
        const start = tokenUnit.start + offset
        const end = tokenUnit.end + offset

        // Add plain text before this token
        if (start > stringIdx) {
            const content = formula.slice(stringIdx, start)
            if (content) {
                units.push(...splitAtLineBreaks({content, type: 'plain'}))
            }
        }

        // Add the token itself
        const content = formula.slice(start, end)
        if (content) {
            units.push(
                ...splitAtLineBreaks({content, type: tokenUnit.tokenType})
            )
        }

        stringIdx = end
    }

    // Add remaining text after last token
    if (stringIdx < formula.length) {
        const content = formula.slice(stringIdx)
        if (content) {
            units.push(...splitAtLineBreaks({content, type: 'plain'}))
        }
    }

    return units
}

/**
 * Split a display unit at line breaks.
 */
function splitAtLineBreaks(unit: DisplayUnit): DisplayUnit[] {
    const units: DisplayUnit[] = []
    const parts = unit.content.split(EOF)

    for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
            units.push({content: parts[i], type: unit.type})
        }
        if (i < parts.length - 1) {
            units.push({content: '', type: 'eof'})
        }
    }

    return units
}

/**
 * Check if a cell reference is local to the current sheet.
 * Local refs get colored backgrounds, external refs are plain text.
 */
export function isLocalCellRef(
    cellRef: CellRef,
    currentSheet: string
): boolean {
    // External workbook reference
    if (cellRef.workbook !== undefined) {
        return false
    }
    // 3D reference (Sheet1:Sheet2)
    if (cellRef.sheet1 !== undefined && cellRef.sheet2 !== undefined) {
        return false
    }
    // Different sheet reference
    if (cellRef.sheet1 !== undefined && cellRef.sheet1 !== currentSheet) {
        return false
    }
    return true
}

/**
 * Simple fuzzy match using longest common subsequence.
 */
export function fuzzyMatch(
    query: string,
    target: string
): {matched: boolean; indices: number[]} {
    const queryLower = query.toLowerCase()
    const targetLower = target.toLowerCase()
    const indices: number[] = []

    let queryIdx = 0
    for (
        let i = 0;
        i < targetLower.length && queryIdx < queryLower.length;
        i++
    ) {
        if (targetLower[i] === queryLower[queryIdx]) {
            indices.push(i)
            queryIdx++
        }
    }

    return {
        matched: queryIdx === queryLower.length,
        indices,
    }
}

/**
 * Check if text starts with '=' indicating a formula.
 */
export function isFormula(text: string): boolean {
    const trimmed = text.trim()
    if (trimmed.startsWith('=')) return true
    // Array formula
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return trimmed.slice(1).trim().startsWith('=')
    }
    return false
}

/**
 * Measure text width using a canvas context.
 */
let measureCanvas: HTMLCanvasElement | null = null
let measureCtx: CanvasRenderingContext2D | null = null

export function measureText(text: string, font: string): number {
    if (!measureCanvas) {
        measureCanvas = document.createElement('canvas')
        measureCtx = measureCanvas.getContext('2d')
    }
    if (!measureCtx) return text.length * 8 // Fallback

    measureCtx.font = font
    return measureCtx.measureText(text).width
}

/**
 * Generate a simple UUID.
 */
export function simpleUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}
