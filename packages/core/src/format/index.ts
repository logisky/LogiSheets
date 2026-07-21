// Format payload generators — engine-neutral.
//
// These turn a selection (`SelectedData`) plus a style intent into the
// cell/line style-update payloads the engine applies. They are PURE LOGIC:
// they build plain payload objects and import only TYPES from logisheets-web,
// so they carry no runtime dependency and run identically in the browser and
// on Node. WorkbookOps wraps each one as a named operation (setFont, setBorder,
// ...); the host only supplies the current sheet index and the selection.
//
// Lifted out of the browser's src/components/toolbar/payload.ts so the Node
// runtime gets the same formatting operations.

import type {
    Alignment,
    Payload,
    StPatternType,
    StBorderStyle,
    SelectedData,
    StyleUpdateType,
    PatternFill,
    Color,
} from 'logisheets-web'

// Local, type-narrowing equivalents of logisheets-web's getSelectedCellRange /
// getSelectedLines (which are runtime helpers); inlined here to keep this
// module free of any runtime import.
function selectedCellRange(v: SelectedData) {
    return v.data?.ty === 'cellRange' ? v.data.d : undefined
}
function selectedLines(v: SelectedData) {
    return v.data?.ty === 'line' ? v.data.d : undefined
}

function hexToColor(hex: string): Color {
    let h = hex.startsWith('#') ? hex.slice(1) : hex
    // ARGB format (8 chars): skip the first 2 alpha chars
    if (h.length === 8) h = h.substring(2)
    return {
        red: parseInt(h.substring(0, 2), 16),
        green: parseInt(h.substring(2, 4), 16),
        blue: parseInt(h.substring(4, 6), 16),
    }
}

function cellStyle(
    sheetIdx: number,
    row: number,
    col: number,
    ty: StyleUpdateType
): Payload {
    return {type: 'cellStyleUpdate', value: {sheetIdx, row, col, ty}}
}

function lineStyle(
    sheetIdx: number,
    from: number,
    to: number,
    row: boolean,
    ty: StyleUpdateType
): Payload {
    return {type: 'lineStyleUpdate', value: {sheetIdx, from, to, row, ty}}
}

export interface FontStyle {
    bold?: boolean
    underline?: boolean
    italic?: boolean
    color?: string
    size?: number
    strike?: boolean
    /** Font family name, e.g. "Arial", "Times New Roman", "微软雅黑". */
    name?: string
}

export function generateFontPayload(
    sheetIdx: number,
    data: SelectedData,
    update: FontStyle
): readonly Payload[] {
    if (!data.data) return []
    if (data.data.ty === 'cellRange') {
        const cellTy: StyleUpdateType = {}
        if (update.bold !== undefined) cellTy.setFontBold = update.bold
        if (update.underline !== undefined)
            cellTy.setFontUnderline = update.underline ? 'single' : 'none'
        if (update.italic !== undefined) cellTy.setFontItalic = update.italic
        if (update.color) cellTy.setFontColor = update.color
        if (update.size) cellTy.setFontSize = update.size
        if (update.strike !== undefined) cellTy.setFontStrike = update.strike
        if (update.name) cellTy.setFontName = update.name
        const d = data.data.d
        const result: Payload[] = []
        for (let i = d.startRow; i <= d.endRow; i += 1)
            for (let j = d.startCol; j <= d.endCol; j += 1)
                result.push(cellStyle(sheetIdx, i, j, cellTy))
        return result
    }
    const d = data.data.d
    const lineTy: StyleUpdateType = {}
    if (update.bold !== undefined) lineTy.setFontBold = update.bold
    if (update.underline !== undefined)
        lineTy.setFontUnderline = update.underline ? 'single' : 'none'
    if (update.italic !== undefined) lineTy.setFontItalic = update.italic
    if (update.color) lineTy.setFontColor = update.color
    if (update.size) lineTy.setFontSize = update.size
    if (update.strike !== undefined) lineTy.setFontStrike = update.strike
    if (update.name) lineTy.setFontName = update.name
    return [lineStyle(sheetIdx, d.start, d.end, d.type === 'row', lineTy)]
}

export function generateAlgnmentPayload(
    sheetIdx: number,
    data: SelectedData,
    alignment: Alignment
): readonly Payload[] {
    return generateForSelection(sheetIdx, data, {setAlignment: alignment})
}

export function generateWrapTextPayload(
    sheetIdx: number,
    data: SelectedData,
    wrapText: boolean
): readonly Payload[] {
    return generateForSelection(sheetIdx, data, {setAlignment: {wrapText}})
}

export function generateNumFmtPayload(
    sheetIdx: number,
    data: SelectedData,
    numFmt: string
): readonly Payload[] {
    return generateForSelection(sheetIdx, data, {setNumFmt: numFmt})
}

export function generatePatternFillPayload(
    sheetIdx: number,
    data: SelectedData,
    fgColor?: string,
    bgColor?: string,
    pattern?: StPatternType
): readonly Payload[] {
    const fill: PatternFill = {}
    if (fgColor) fill.fgColor = hexToColor(fgColor)
    if (bgColor) fill.bgColor = hexToColor(bgColor)
    if (pattern) fill.patternType = pattern
    return generateForSelection(sheetIdx, data, {setPatternFill: fill})
}

/** Apply one `StyleUpdateType` across the selection (cell range or line). */
function generateForSelection(
    sheetIdx: number,
    data: SelectedData,
    ty: StyleUpdateType
): readonly Payload[] {
    if (!data.data) return []
    if (data.data.ty === 'cellRange') {
        const d = data.data.d
        const result: Payload[] = []
        for (let i = d.startRow; i <= d.endRow; i += 1)
            for (let j = d.startCol; j <= d.endCol; j += 1)
                result.push(cellStyle(sheetIdx, i, j, ty))
        return result
    }
    const d = data.data.d
    return [lineStyle(sheetIdx, d.start, d.end, d.type === 'row', ty)]
}

type Direction = 'top' | 'bottom' | 'left' | 'right'

export type BatchUpdateType =
    | 'all'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'horizontal'
    | 'vertical'
    | 'outer'
    | 'inner'
    | 'clear'

export interface BorderBatchUpdate {
    batch: BatchUpdateType
    color?: string
    borderType?: StBorderStyle
}

interface BorderUpdate {
    direction: Direction
    color?: string
    borderType?: StBorderStyle
}

export function generateBorderPayloads(
    sheetIdx: number,
    data: SelectedData,
    update: BorderBatchUpdate
): readonly Payload[] {
    if (update.color) {
        if (update.color.startsWith('#')) update.color = update.color.slice(1)
        update.color = update.color.toUpperCase()
    }
    const cellRange = selectedCellRange(data)
    if (cellRange) {
        return generateBorderBatchCellPayload(
            sheetIdx,
            cellRange.startRow,
            cellRange.endRow,
            cellRange.startCol,
            cellRange.endCol,
            update
        )
    }
    return generateBorderBatchLinePayload(sheetIdx, data, update)
}

function generateBorderBatchLinePayload(
    sheetIdx: number,
    data: SelectedData,
    update: BorderBatchUpdate
): readonly Payload[] {
    const lineRange = selectedLines(data)
    if (!lineRange) return []
    const result: Payload[] = []
    const drawLeftBorder = () => {
        if (lineRange.type === 'row') return
        result.push(
            ...generateLineDoubleBorderPayload(
                sheetIdx,
                lineRange.start,
                false,
                {
                    direction: 'left',
                    color: update.color,
                    borderType: update.borderType,
                }
            )
        )
    }
    const drawRightBorder = () => {
        if (lineRange.type === 'row') return
        result.push(
            ...generateLineDoubleBorderPayload(sheetIdx, lineRange.end, false, {
                direction: 'right',
                color: update.color,
                borderType: update.borderType,
            })
        )
    }
    const drawTopBorder = () => {
        if (lineRange.type !== 'row') return
        result.push(
            ...generateLineDoubleBorderPayload(
                sheetIdx,
                lineRange.start,
                true,
                {
                    direction: 'top',
                    color: update.color,
                    borderType: update.borderType,
                }
            )
        )
    }
    const drawBottomBorder = () => {
        if (lineRange.type !== 'row') return
        result.push(
            ...generateLineDoubleBorderPayload(sheetIdx, lineRange.end, true, {
                direction: 'bottom',
                color: update.color,
                borderType: update.borderType,
            })
        )
    }
    const position = ['top', 'bottom', 'left', 'right']
    const drawInnerBorder = () => {
        for (let i = lineRange.start; i <= lineRange.end; i += 1) {
            position.forEach((p) => {
                if (lineRange.type === 'row') {
                    if (p === 'top' && i === lineRange.start) return
                    if (p === 'bottom' && i === lineRange.end) return
                }
                if (lineRange.type === 'col') {
                    if (p === 'left' && i === lineRange.start) return
                    if (p === 'right' && i === lineRange.end) return
                }
                result.push(
                    generateLineSingleBorderPayload(
                        sheetIdx,
                        i,
                        lineRange.type === 'row',
                        {
                            direction: p as Direction,
                            color: update.color,
                            borderType: update.borderType,
                        }
                    )
                )
            })
        }
    }

    switch (update.batch) {
        case 'all':
            drawInnerBorder()
            drawTopBorder()
            drawBottomBorder()
            drawLeftBorder()
            drawRightBorder()
            break
        case 'top':
            if (lineRange.type === 'col') return []
            drawTopBorder()
            break
        case 'bottom':
            if (lineRange.type === 'col') return []
            drawBottomBorder()
            break
        case 'left':
            if (lineRange.type === 'row') return []
            drawLeftBorder()
            break
        case 'right':
            if (lineRange.type === 'row') return []
            drawRightBorder()
            break
        case 'horizontal':
            drawInnerBorder()
            break
        case 'vertical':
            drawInnerBorder()
            break
        case 'outer':
            drawTopBorder()
            drawBottomBorder()
            drawLeftBorder()
            drawRightBorder()
            break
        case 'inner':
            drawInnerBorder()
            break
        case 'clear':
            for (let i = lineRange.start; i <= lineRange.end; i += 1) {
                position.forEach((d) => {
                    result.push(
                        ...generateLineDoubleBorderPayload(
                            sheetIdx,
                            i,
                            lineRange.type === 'row',
                            {direction: d as Direction, borderType: 'none'}
                        )
                    )
                })
            }
    }
    return result
}

function generateBorderBatchCellPayload(
    sheetIdx: number,
    fromRow: number,
    toRow: number,
    fromCol: number,
    toCol: number,
    update: BorderBatchUpdate
): readonly Payload[] {
    const payloads: Payload[] = []
    const drawLeftBorder = () => {
        for (let i = fromRow; i <= toRow; i += 1)
            payloads.push(
                ...generateDoubleBorderPayload(sheetIdx, i, fromCol, {
                    direction: 'left',
                    color: update.color,
                    borderType: update.borderType,
                })
            )
    }
    const drawRightBorder = () => {
        for (let i = fromRow; i <= toRow; i += 1)
            payloads.push(
                ...generateDoubleBorderPayload(sheetIdx, i, toCol, {
                    direction: 'right',
                    color: update.color,
                    borderType: update.borderType,
                })
            )
    }
    const drawTopBorder = () => {
        for (let j = fromCol; j <= toCol; j += 1)
            payloads.push(
                ...generateDoubleBorderPayload(sheetIdx, fromRow, j, {
                    direction: 'top',
                    color: update.color,
                    borderType: update.borderType,
                })
            )
    }
    const drawBottomBorder = () => {
        for (let j = fromCol; j <= toCol; j += 1)
            payloads.push(
                ...generateDoubleBorderPayload(sheetIdx, toRow, j, {
                    direction: 'bottom',
                    color: update.color,
                    borderType: update.borderType,
                })
            )
    }
    const drawInnerBorder = (type: 'vertical' | 'horizontal' | 'all') => {
        for (let i = fromRow; i <= toRow; i += 1) {
            for (let j = fromCol; j <= toCol; j += 1) {
                if (j < toCol && (type === 'vertical' || type === 'all')) {
                    payloads.push(
                        ...generateDoubleBorderPayload(sheetIdx, i, j, {
                            direction: 'right',
                            color: update.color,
                            borderType: update.borderType,
                        })
                    )
                }
                if (i < toRow && (type === 'horizontal' || type === 'all')) {
                    payloads.push(
                        ...generateDoubleBorderPayload(sheetIdx, i, j, {
                            direction: 'bottom',
                            color: update.color,
                            borderType: update.borderType,
                        })
                    )
                }
            }
        }
    }

    switch (update.batch) {
        case 'all':
            drawLeftBorder()
            drawRightBorder()
            drawTopBorder()
            drawBottomBorder()
            drawInnerBorder('all')
            break
        case 'top':
            drawTopBorder()
            break
        case 'bottom':
            drawBottomBorder()
            break
        case 'left':
            drawLeftBorder()
            break
        case 'right':
            drawRightBorder()
            break
        case 'horizontal':
            drawInnerBorder('horizontal')
            break
        case 'vertical':
            drawInnerBorder('vertical')
            break
        case 'outer':
            drawLeftBorder()
            drawRightBorder()
            drawTopBorder()
            drawBottomBorder()
            break
        case 'inner':
            drawInnerBorder('all')
            break
        case 'clear':
    }
    return payloads
}

function generateLineDoubleBorderPayload(
    sheetIdx: number,
    line: number,
    row: boolean,
    update: BorderUpdate
): Payload[] {
    const result: Payload[] = [
        generateLineSingleBorderPayload(sheetIdx, line, row, {
            direction: update.direction,
            color: update.color,
            borderType: update.borderType,
        }),
    ]
    const direction: Direction = row ? 'top' : 'left'
    const op = direction === 'top' ? 'bottom' : 'right'
    if (line - 1 >= 0) {
        result.push(
            generateLineSingleBorderPayload(sheetIdx, line - 1, row, {
                direction: op,
                color: update.color,
                borderType: 'none',
            })
        )
    }
    return result
}

function generateLineSingleBorderPayload(
    sheetIdx: number,
    line: number,
    row: boolean,
    update: BorderUpdate
): Payload {
    const ty: StyleUpdateType = {}
    switch (update.direction) {
        case 'bottom':
            if (!row) break
            if (update.color) ty.setBottomBorderColor = update.color
            if (update.borderType) ty.setBottomBorderStyle = update.borderType
            break
        case 'top':
            if (update.color) ty.setTopBorderColor = update.color
            if (update.borderType) ty.setTopBorderStyle = update.borderType
            break
        case 'left':
            if (update.color) ty.setLeftBorderColor = update.color
            if (update.borderType) ty.setLeftBorderStyle = update.borderType
            break
        case 'right':
            if (row) break
            if (update.color) ty.setRightBorderColor = update.color
            if (update.borderType) ty.setRightBorderStyle = update.borderType
            break
    }
    return lineStyle(sheetIdx, line, line, row, ty)
}

function generateDoubleBorderPayload(
    sheetIdx: number,
    row: number,
    col: number,
    update: BorderUpdate
): readonly Payload[] {
    const payload = generateSingleBorderPayload(sheetIdx, row, col, update)
    let clear: Payload | undefined
    switch (update.direction) {
        case 'bottom':
            clear = getClearBorderPayload(sheetIdx, row + 1, col, 'top')
            break
        case 'top':
            if (row - 1 >= 0)
                clear = getClearBorderPayload(sheetIdx, row - 1, col, 'bottom')
            break
        case 'left':
            if (col - 1 >= 0)
                clear = getClearBorderPayload(sheetIdx, row, col - 1, 'right')
            break
        case 'right':
            clear = getClearBorderPayload(sheetIdx, row, col + 1, 'left')
            break
    }
    const result: Payload[] = [payload]
    if (clear) result.push(clear)
    return result
}

function generateSingleBorderPayload(
    sheetIdx: number,
    row: number,
    col: number,
    update: BorderUpdate
): Payload {
    const ty: StyleUpdateType = {}
    switch (update.direction) {
        case 'bottom':
            if (update.color) ty.setBottomBorderColor = update.color
            if (update.borderType) ty.setBottomBorderStyle = update.borderType
            break
        case 'top':
            if (update.color) ty.setTopBorderColor = update.color
            if (update.borderType) ty.setTopBorderStyle = update.borderType
            break
        case 'left':
            if (update.color) ty.setLeftBorderColor = update.color
            if (update.borderType) ty.setLeftBorderStyle = update.borderType
            break
        case 'right':
            if (update.color) ty.setRightBorderColor = update.color
            if (update.borderType) ty.setRightBorderStyle = update.borderType
            break
    }
    return cellStyle(sheetIdx, row, col, ty)
}

function getClearBorderPayload(
    sheetIdx: number,
    row: number,
    col: number,
    direction: Direction
): Payload {
    const ty: StyleUpdateType = {}
    switch (direction) {
        case 'top':
            ty.setTopBorderStyle = 'none'
            break
        case 'bottom':
            ty.setBottomBorderStyle = 'none'
            break
        case 'left':
            ty.setLeftBorderStyle = 'none'
            break
        case 'right':
            ty.setRightBorderStyle = 'none'
            break
    }
    return cellStyle(sheetIdx, row, col, ty)
}
