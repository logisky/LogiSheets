import {action, makeObservable, observable} from 'mobx'
import {CanvasStore} from './store'
import {StandardColor, Range} from '@/core/standable'
import {getTokens} from '@/core/formula'
import {parseA1notation} from '@/core'

export class HighlightCellStyle {
    bgColor = new StandardColor()
    x: number = 0
    y: number = 0
    width: number = 0
    height: number = 0
}

export interface HighlightCell {
    readonly rowStart: number
    readonly colStart: number
    readonly rowEnd?: number
    readonly colEnd?: number
    readonly style: HighlightCellStyle
}

export class Highlights {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }

    @observable
    highlightCells: HighlightCell[] = []

    @action
    reset() {
        this.highlightCells = []
    }

    @action
    update(text: string) {
        const ranges = getRanges(text)
        const newCells: HighlightCell[] = []
        const viewRange = this.store.getCurrentCellView()
        const find = (cell: HighlightCell) => {
            return this.highlightCells.find((c) => equal(c, cell))
        }
        ranges.forEach((r) => {
            const result = parseA1notation(r)
            if (!result) return
            const {rs: rowStart, re: rowEnd, cs: colStart, ce: colEnd} = result
            const newCell = {
                rowStart,
                rowEnd,
                colStart,
                colEnd,
                style: new HighlightCellStyle(),
            }
            const cell = viewRange.cells.find((c) => {
                const range = new Range()
                    .setStartCol(newCell.colStart)
                    .setStartRow(newCell.rowStart)
                    .setEndCol(newCell.colEnd ?? newCell.colStart)
                    .setEndRow(newCell.rowEnd ?? newCell.rowStart)
                return c.coordinate.cover(range)
            })
            if (!cell) return
            const oldCell = find(newCell)
            if (oldCell) newCell.style = oldCell.style
            else {
                const canvasPosition = this.store.convertToCanvasPosition(
                    cell.position,
                    'Cell'
                )
                const currColors = newCells.map((c) => c.style.bgColor)
                newCell.style = {
                    bgColor: StandardColor.randomColor(currColors),
                    x: canvasPosition.startCol,
                    y: canvasPosition.startRow,
                    height: canvasPosition.height,
                    width: canvasPosition.width,
                }
            }
            newCells.push(newCell)
        })
        this.highlightCells = newCells
    }
}

const getRanges = (formula: string) => {
    const tokens = getTokens(formula)
    return tokens.map((t) => t.value)
}

function equal(cell1: HighlightCell, cell2: HighlightCell) {
    return (
        cell1.colEnd === cell2.colEnd &&
        cell1.colStart === cell2.colStart &&
        cell1.rowEnd === cell2.rowEnd &&
        cell1.rowStart === cell2.rowStart
    )
}
