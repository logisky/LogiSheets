import {getSelectedCellRange, getSelectedLines} from 'logisheets-engine'
import {
    Alignment,
    Payload,
    StPatternType,
    StBorderStyle,
    SelectedData,
    CellStyleUpdateBuilder,
    LineStyleUpdateBuilder,
    StyleUpdateTypeBuilder,
    Color,
    PatternFill,
} from 'logisheets-engine'

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
                const style = new StyleUpdateTypeBuilder()
                if (update.bold !== undefined) style.setFontBold(update.bold)
                if (update.underline !== undefined)
                    style.setFontUnderline(update.underline ? 'single' : 'none')
                if (update.italic !== undefined) style.setFontItalic(update.italic)
                if (update.color) style.setFontColor(update.color)
                if (update.size) style.setFontSize(update.size)
                if (update.strike !== undefined) style.setFontStrike(update.strike)
                result.push({
                    type: 'cellStyleUpdate',
                    value: new CellStyleUpdateBuilder()
                        .sheetIdx(sheetIdx)
                        .row(i)
                        .col(j)
                        .ty(style.build())
                        .build(),
                })
            }
        }
        return result
    }
    const d = data.data.d
    const style = new StyleUpdateTypeBuilder()
    if (update.bold !== undefined) style.setFontBold(update.bold)
    if (update.underline !== undefined)
        style.setFontUnderline(update.underline ? 'single' : 'none')
    if (update.italic !== undefined) style.setFontItalic(update.italic)
    if (update.color) style.setFontColor(update.color)
    result.push({
        type: 'lineStyleUpdate',
        value: new LineStyleUpdateBuilder()
            .sheetIdx(sheetIdx)
            .row(d.type === 'row')
            .from(d.start)
            .to(d.end)
            .ty(style.build())
            .build(),
    })
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
                result.push({
                    type: 'cellStyleUpdate',
                    value: new CellStyleUpdateBuilder()
                        .sheetIdx(sheetIdx)
                        .row(i)
                        .col(j)
                        .ty(new StyleUpdateTypeBuilder().setAlignment(alignment).build())
                        .build(),
                })
            }
        }
        return result
    }
    const d = data.data.d
    result.push({
        type: 'lineStyleUpdate',
        value: new LineStyleUpdateBuilder()
            .sheetIdx(sheetIdx)
            .row(d.type === 'row')
            .from(d.start)
            .to(d.end)
            .ty(new StyleUpdateTypeBuilder().setAlignment(alignment).build())
            .build(),
    })

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
                result.push({
                    type: 'cellStyleUpdate',
                    value: new CellStyleUpdateBuilder()
                        .sheetIdx(sheetIdx)
                        .row(i)
                        .col(j)
                        .ty(new StyleUpdateTypeBuilder().setAlignment({wrapText}).build())
                        .build(),
                })
            }
        }
        return result
    }
    const d = data.data.d
    result.push({
        type: 'lineStyleUpdate',
        value: new LineStyleUpdateBuilder()
            .sheetIdx(sheetIdx)
            .row(d.type === 'row')
            .from(d.start)
            .to(d.end)
            .ty(new StyleUpdateTypeBuilder().setAlignment({wrapText}).build())
            .build(),
    })

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
                result.push({
                    type: 'cellStyleUpdate',
                    value: new CellStyleUpdateBuilder()
                        .sheetIdx(sheetIdx)
                        .row(i)
                        .col(j)
                        .ty(new StyleUpdateTypeBuilder().setNumFmt(numFmt).build())
                        .build(),
                })
            }
        }
        return result
    }
    const d = data.data.d
    result.push({
        type: 'lineStyleUpdate',
        value: new LineStyleUpdateBuilder()
            .sheetIdx(sheetIdx)
            .from(d.start)
            .to(d.end)
            .row(d.type === 'row')
            .ty(new StyleUpdateTypeBuilder().setNumFmt(numFmt).build())
            .build(),
    })
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
    const fill: PatternFill = {}
    if (fgColor) fill.fgColor = hexToColor(fgColor)
    if (bgColor) fill.bgColor = hexToColor(bgColor)
    if (pattern) fill.patternType = pattern

    const t = data.data.ty
    if (t === 'cellRange') {
        const d = data.data.d
        for (let i = d.startRow; i <= d.endRow; i += 1) {
            for (let j = d.startCol; j <= d.endCol; j += 1) {
                result.push({
                    type: 'cellStyleUpdate',
                    value: new CellStyleUpdateBuilder()
                        .sheetIdx(sheetIdx)
                        .row(i)
                        .col(j)
                        .ty(new StyleUpdateTypeBuilder().setPatternFill(fill).build())
                        .build(),
                })
            }
        }
        return result
    }
    const d = data.data.d
    result.push({
        type: 'lineStyleUpdate',
        value: new LineStyleUpdateBuilder()
            .sheetIdx(sheetIdx)
            .from(d.start)
            .to(d.end)
            .row(d.type === 'row')
            .ty(new StyleUpdateTypeBuilder().setPatternFill(fill).build())
            .build(),
    })
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
    const style = new StyleUpdateTypeBuilder()
    switch (update.direction) {
        case 'bottom':
            if (!row) break
            if (update.color) style.setBottomBorderColor(update.color)
            if (update.borderType) style.setBottomBorderStyle(update.borderType)
            break
        case 'top':
            if (update.color) style.setTopBorderColor(update.color)
            if (update.borderType) style.setTopBorderStyle(update.borderType)
            break
        case 'left':
            if (update.color) style.setLeftBorderColor(update.color)
            if (update.borderType) style.setLeftBorderStyle(update.borderType)
            break
        case 'right':
            if (row) break
            if (update.color) style.setRightBorderColor(update.color)
            if (update.borderType) style.setRightBorderStyle(update.borderType)
            break
    }
    return {
        type: 'lineStyleUpdate',
        value: new LineStyleUpdateBuilder()
            .sheetIdx(sheetIdx)
            .from(line)
            .to(line)
            .row(row)
            .ty(style.build())
            .build(),
    }
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
    const style = new StyleUpdateTypeBuilder()
    switch (update.direction) {
        case 'bottom':
            if (update.color) style.setBottomBorderColor(update.color)
            if (update.borderType) style.setBottomBorderStyle(update.borderType)
            break
        case 'top':
            if (update.color) style.setTopBorderColor(update.color)
            if (update.borderType) style.setTopBorderStyle(update.borderType)
            break
        case 'left':
            if (update.color) style.setLeftBorderColor(update.color)
            if (update.borderType) style.setLeftBorderStyle(update.borderType)
            break
        case 'right':
            if (update.color) style.setRightBorderColor(update.color)
            if (update.borderType) style.setRightBorderStyle(update.borderType)
            break
    }
    return {
        type: 'cellStyleUpdate',
        value: new CellStyleUpdateBuilder()
            .sheetIdx(sheetIdx)
            .row(row)
            .col(col)
            .ty(style.build())
            .build(),
    }
}

function getClearBorderPayload(
    sheetIdx: number,
    row: number,
    col: number,
    direction: Direction
): Payload {
    const style = new StyleUpdateTypeBuilder()
    switch (direction) {
        case 'top':
            style.setTopBorderStyle('none')
            break
        case 'bottom':
            style.setBottomBorderStyle('none')
            break
        case 'left':
            style.setLeftBorderStyle('none')
            break
        case 'right':
            style.setRightBorderStyle('none')
            break
    }
    return {
        type: 'cellStyleUpdate',
        value: new CellStyleUpdateBuilder()
            .sheetIdx(sheetIdx)
            .row(row)
            .col(col)
            .ty(style.build())
            .build(),
    }
}
