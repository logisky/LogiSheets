import { useState } from "react"
import {parseA1notation} from '@/common/a1notation'
import { getTokens } from "@/core/formula"
import { DATA_SERVICE } from "@/core/data"
import { Range, StandardColor } from "@/core/standable"

const initStyle = (): HighlightCellStyle => {
    return {
        bgColor: new StandardColor(),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    }
}
export interface HighlightCellStyle {
    readonly bgColor: StandardColor
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
}

export interface HighlightCell {
    readonly rowStart: number
    readonly colStart: number
    readonly rowEnd?: number
    readonly colEnd?: number
    readonly style: HighlightCellStyle
}

export function equal(cell1: HighlightCell, cell2: HighlightCell) {
    return cell1.colEnd === cell2.colEnd
        && cell1.colStart === cell2.colStart
        && cell1.rowEnd === cell2.rowEnd
        && cell1.rowStart === cell2.rowStart
}

// 接受从当前输入框中，输入的a1notation以高亮对应的单元格
export const useHighlightCell = () => {
    const [highlightCells, setHighlightCells] = useState<HighlightCell[]>([])

    const getRanges = (formula: string) => {
        const tokens = getTokens(formula)
        return tokens.map(t => t.value)
    }
    const blur = () => {
        setHighlightCells([])
    }

    const update = (text: string) => {
        const ranges = getRanges(text)
        const newCells: HighlightCell[] = []
        const viewRange = DATA_SERVICE.cachedViewRange
        const find = (cell: HighlightCell) => {
            return highlightCells.find(c => equal(c, cell))
        }
        ranges.forEach(r => {
            const result = parseA1notation(r)
            if (!result)
                return
            const {rs: rowStart, re: rowEnd, cs: colStart, ce: colEnd} = result
            const newCell = {
                rowStart,
                rowEnd,
                colStart,
                colEnd,
                style: initStyle(),
            }
            const cell = viewRange.cells.find(c => {
                const range = new Range()
                    .setStartCol(newCell.colStart)
                    .setStartRow(newCell.rowStart)
                    .setEndCol(newCell.colEnd ?? newCell.colStart)
                    .setEndRow(newCell.rowEnd ?? newCell.rowStart)
                return c.coodinate.cover(range)
            })
            if (!cell)
                return
            const oldCell = find(newCell)
            if (oldCell)
                newCell.style = oldCell.style
            else {
                const currColors = newCells.map(c => c.style.bgColor)
                newCell.style = {
                    bgColor: StandardColor.randomColor(currColors),
                    x: cell.position.startCol,
                    y: cell.position.startRow,
                    height: cell.height,
                    width: cell.width,
                }
            }
            newCells.push(newCell)
        })
        setHighlightCells(newCells)
    }
    const init = (text: string) => {
        const ranges = getRanges(text)
        const newCells: HighlightCell[] = []
        const viewRange = DATA_SERVICE.cachedViewRange
        ranges.forEach(r => {
            const result = parseA1notation(r)
            if (!result)
                return
            const {rs: rowStart, re: rowEnd, cs: colStart, ce: colEnd} = result
            const newCell = {
                rowStart,
                rowEnd,
                colStart,
                colEnd,
                style: initStyle(),
            }
            const cell = viewRange.cells.find(c => {
                const range = new Range()
                    .setStartRow(newCell.rowStart)
                    .setStartCol(newCell.colStart)
                    .setEndCol(newCell.colEnd ?? newCell.colStart)
                    .setEndRow(newCell.rowEnd ?? newCell.rowStart)
                return c.coodinate.cover(range)
            })
            if (!cell)
                return
            const currColors = newCells.map(c => c.style.bgColor)
            newCells.push({
                ...newCell,
                style: {
                    bgColor: StandardColor.randomColor(currColors),
                    x: cell.position.startCol,
                    y: cell.position.startRow,
                    height: cell.height,
                    width: cell.width,
                }
            })
        })
        setHighlightCells(newCells)
    }
    return {
        highlightCells,
        update,
        init,
        blur,
    }
}