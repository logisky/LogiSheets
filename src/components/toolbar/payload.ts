import {getSelectedCellRange, getSelectedLines} from 'logisheets-engine'
import {
    Alignment,
    Payload,
    SetCellAlignmentBuilder,
    SetCellFontBuilder,
    SetCellPatternFillBuilder,
    SetLineAlignmentBuilder,
    SetLineFontBuilder,
    SetLinePatternFillBuilder,
    StPatternType,
    StBorderStyle,
    SetCellBorderBuilder,
    SetLineBorderBuilder,
    SetCellWrapTextBuilder,
    SetLineWrapTextBuilder,
    SetCellNumFmtBuilder,
    SetLineNumFmtBuilder,
    SelectedData,
} from 'logisheets-engine'

export interface FontStyle {
    bold?: boolean
    underline?: boolean
    italic?: boolean
    color?: string
    size?: number
    strike?: boolean
}
export function generateFontPayload(
    sheetIdx: number,
    data: SelectedData,
    update: FontStyle
): readonly Payload[] {
    if (!data.data) return []
    const result: Payload[] = []
    const t = data.data.ty
    if (t === 'cellRange') {
        const d = data.data.d
        for (let i = d.startRow; i <= d.endRow; i += 1) {
            for (let j = d.startCol; j <= d.endCol; j += 1) {
                const builder = new SetCellFontBuilder()
                    .sheetIdx(sheetIdx)
                    .row(i)
                    .col(j)
                if (update.bold !== undefined) builder.bold(update.bold)
                if (update.underline !== undefined)
                    builder.underline(update.underline ? 'single' : 'none')
                if (update.italic !== undefined) builder.italic(update.italic)
                if (update.color) builder.color(update.color)
                if (update.size) builder.size(update.size)
                if (update.strike !== undefined) builder.strike(update.strike)
                const p = builder.build()
                result.push({type: 'setCellFont', value: p})
            }
        }
        return result
    }
    const d = data.data.d
    const builder = new SetLineFontBuilder()
        .sheetIdx(sheetIdx)
        .row(d.type === 'row')
        .from(d.start)
        .to(d.end)
    if (update.bold !== undefined) builder.bold(update.bold)
    if (update.underline !== undefined)
        builder.underline(update.underline ? 'single' : 'none')
    if (update.italic !== undefined) builder.italic(update.italic)
    if (update.color) builder.color(update.color)
    const p = builder.build()
    result.push({type: 'setLineFont', value: p})
    return result
}

export function generateAlgnmentPayload(
    sheetIdx: number,
    data: SelectedData,
    alignment: Alignment
): readonly Payload[] {
    if (!data.data) return []
    const result: Payload[] = []
    const t = data.data.ty
    if (t === 'cellRange') {
        const d = data.data.d
        for (let i = d.startRow; i <= d.endRow; i += 1) {
            for (let j = d.startCol; j <= d.endCol; j += 1) {
                const p = new SetCellAlignmentBuilder()
                    .sheetIdx(sheetIdx)
                    .row(i)
                    .col(j)
                    .alignment(alignment)
                    .build()
                result.push({type: 'setCellAlignment', value: p})
            }
        }
        return result
    }
    const d = data.data.d
    const p = new SetLineAlignmentBuilder()
        .sheetIdx(sheetIdx)
        .row(d.type === 'row')
        .from(d.start)
        .to(d.end)
        .alignment(alignment)
        .build()
    result.push({type: 'setLineAlignment', value: p})

    return result
}

export function generateWrapTextPayload(
    sheetIdx: number,
    data: SelectedData,
    wrapText: boolean
): Payload[] {
    if (!data.data) return []
    const result: Payload[] = []
    const t = data.data.ty
    if (t === 'cellRange') {
        const d = data.data.d
        for (let i = d.startRow; i <= d.endRow; i += 1) {
            for (let j = d.startCol; j <= d.endCol; j += 1) {
                const p = new SetCellWrapTextBuilder()
                    .sheetIdx(sheetIdx)
                    .row(i)
                    .col(j)
                    .wrapText(wrapText)
                    .build()
                result.push({type: 'setCellWrapText', value: p})
            }
        }
        return result
    }
    const d = data.data.d
    const p = new SetLineWrapTextBuilder()
        .sheetIdx(sheetIdx)
        .row(d.type === 'row')
        .from(d.start)
        .to(d.end)
        .wrapText(wrapText)
        .build()
    result.push({type: 'setLineWrapText', value: p})

    return result
}

export function generateNumFmtPayload(
    sheetIdx: number,
    data: SelectedData,
    numFmt: string
): Payload[] {
    if (!data.data) return []
    const result: Payload[] = []
    const t = data.data.ty
    if (t === 'cellRange') {
        const d = data.data.d
        for (let i = d.startRow; i <= d.endRow; i += 1) {
            for (let j = d.startCol; j <= d.endCol; j += 1) {
                const builder = new SetCellNumFmtBuilder()
                    .sheetIdx(sheetIdx)
                    .row(i)
                    .col(j)
                    .numFmt(numFmt)
                const p = builder.build()
                result.push({type: 'setCellNumFmt', value: p})
            }
        }
        return result
    }
    const d = data.data.d
    const builder = new SetLineNumFmtBuilder()
        .sheetIdx(sheetIdx)
        .from(d.start)
        .to(d.end)
        .row(d.type === 'row')
        .numFmt(numFmt)
    const p = builder.build()
    result.push({type: 'setLineNumFmt', value: p})
    return result
}

export function generatePatternFillPayload(
    sheetIdx: number,
    data: SelectedData,
    fgColor?: string,
    bgColor?: string,
    pattern?: StPatternType
): Payload[] {
    if (!data.data) return []
    const result: Payload[] = []
    const t = data.data.ty
    if (t === 'cellRange') {
        const d = data.data.d
        for (let i = d.startRow; i <= d.endRow; i += 1) {
            for (let j = d.startCol; j <= d.endCol; j += 1) {
                const builder = new SetCellPatternFillBuilder()
                    .sheetIdx(sheetIdx)
                    .row(i)
                    .col(j)
                if (fgColor) builder.fgColor(fgColor)
                if (bgColor) builder.bgColor(bgColor)
                if (pattern) builder.pattern(pattern)
                const p = builder.build()
                result.push({type: 'setCellPatternFill', value: p})
            }
        }
        return result
    }
    const d = data.data.d
    const builder = new SetLinePatternFillBuilder()
        .sheetIdx(sheetIdx)
        .from(d.start)
        .to(d.end)
        .row(d.type === 'row')
    if (fgColor) builder.fgColor(fgColor)
    if (bgColor) builder.bgColor(bgColor)
    if (pattern) builder.pattern(pattern)
    const p = builder.build()
    result.push({type: 'setLinePatternFill', value: p})
    return result
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

export interface BorderUpdate {
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
        if (update.color.startsWith('#')) {
            update.color = update.color.slice(1)
        }
        update.color = update.color.toUpperCase()
    }
    const cellRange = getSelectedCellRange(data)
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
    const lineRange = getSelectedLines(data)
    if (!lineRange) return []
    const result: Payload[] = []
    const drawLeftBorder = () => {
        if (lineRange.type === 'row') {
            return
        }
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
        if (lineRange.type === 'row') {
            return
        }
        result.push(
            ...generateLineDoubleBorderPayload(sheetIdx, lineRange.end, false, {
                direction: 'right',
                color: update.color,
                borderType: update.borderType,
            })
        )
    }

    const drawTopBorder = () => {
        if (lineRange.type !== 'row') {
            return
        }
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
        if (lineRange.type !== 'row') {
            return
        }
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
                    if (p === 'top' && i === lineRange.start) {
                        return
                    }
                    if (p === 'bottom' && i === lineRange.end) {
                        return
                    }
                }
                if (lineRange.type === 'col') {
                    if (p === 'left' && i === lineRange.start) {
                        return
                    }
                    if (p === 'right' && i === lineRange.end) {
                        return
                    }
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
            if (lineRange.type === 'col') {
                return []
            }
            drawTopBorder()
            break
        case 'bottom':
            if (lineRange.type === 'col') {
                return []
            }
            drawBottomBorder()
            break
        case 'left':
            if (lineRange.type === 'row') {
                return []
            }
            drawLeftBorder()
            break
        case 'right':
            if (lineRange.type === 'row') {
                return []
            }
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
                            {
                                direction: d as Direction,
                                borderType: 'none',
                            }
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
        for (let i = fromRow; i <= toRow; i += 1) {
            payloads.push(
                ...generateDoubleBorderPayload(sheetIdx, i, fromCol, {
                    direction: 'left',
                    color: update.color,
                    borderType: update.borderType,
                })
            )
        }
    }
    const drawRightBorder = () => {
        for (let i = fromRow; i <= toRow; i += 1) {
            payloads.push(
                ...generateDoubleBorderPayload(sheetIdx, i, toCol, {
                    direction: 'right',
                    color: update.color,
                    borderType: update.borderType,
                })
            )
        }
    }
    const drawTopBorder = () => {
        for (let j = fromCol; j <= toCol; j += 1) {
            payloads.push(
                ...generateDoubleBorderPayload(sheetIdx, fromRow, j, {
                    direction: 'top',
                    color: update.color,
                    borderType: update.borderType,
                })
            )
        }
    }
    const drawBottomBorder = () => {
        for (let j = fromCol; j <= toCol; j += 1) {
            payloads.push(
                ...generateDoubleBorderPayload(sheetIdx, toRow, j, {
                    direction: 'bottom',
                    color: update.color,
                    borderType: update.borderType,
                })
            )
        }
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
    const result: Payload[] = []
    result.push(
        generateLineSingleBorderPayload(sheetIdx, line, row, {
            direction: update.direction,
            color: update.color,
            borderType: update.borderType,
        })
    )
    let direction: Direction
    if (row) {
        direction = 'top'
    } else {
        direction = 'left'
    }
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
    const builder = new SetLineBorderBuilder()
        .sheetIdx(sheetIdx)
        .line(line)
        .row(row)
    switch (update.direction) {
        case 'bottom':
            if (!row) break
            if (update.color) builder.bottomColor(update.color)
            if (update.borderType) builder.bottomBorderType(update.borderType)
            break
        case 'top':
            if (update.color) builder.topColor(update.color)
            if (update.borderType) builder.topBorderType(update.borderType)
            break
        case 'left':
            if (update.color) builder.leftColor(update.color)
            if (update.borderType) builder.leftBorderType(update.borderType)
            break
        case 'right':
            if (row) break
            if (update.color) builder.rightColor(update.color)
            if (update.borderType) builder.rightBorderType(update.borderType)
            break
    }
    return {type: 'setLineBorder', value: builder.build()}
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
    const builder = new SetCellBorderBuilder()
        .sheetIdx(sheetIdx)
        .row(row)
        .col(col)
    switch (update.direction) {
        case 'bottom':
            if (update.color) builder.bottomColor(update.color)
            if (update.borderType) builder.bottomBorderType(update.borderType)
            break
        case 'top':
            if (update.color) builder.topColor(update.color)
            if (update.borderType) builder.topBorderType(update.borderType)
            break
        case 'left':
            if (update.color) builder.leftColor(update.color)
            if (update.borderType) builder.leftBorderType(update.borderType)
            break
        case 'right':
            if (update.color) builder.rightColor(update.color)
            if (update.borderType) builder.rightBorderType(update.borderType)
            break
    }
    return {type: 'setCellBorder', value: builder.build()}
}

function getClearBorderPayload(
    sheetIdx: number,
    row: number,
    col: number,
    direction: Direction
): Payload {
    const builder = new SetCellBorderBuilder()
        .sheetIdx(sheetIdx)
        .row(row)
        .col(col)
    switch (direction) {
        case 'top':
            builder.topBorderType('none')
            break
        case 'bottom':
            builder.bottomBorderType('none')
            break
        case 'left':
            builder.leftBorderType('none')
            break
        case 'right':
            builder.rightBorderType('none')
            break
    }
    return {type: 'setCellBorder', value: builder.build()}
}
