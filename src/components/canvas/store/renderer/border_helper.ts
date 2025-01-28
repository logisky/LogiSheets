import {CellView} from '@/core/data'
import {SETTINGS} from '@/core/settings'
import {BorderPr} from 'logisheets-web'

/**
 * BorderHelper is used to generate the continuous borders. Drawing borders
 * cell by cell will make the borders discontinuous.
 */
export class BorderHelper {
    constructor(private readonly _data: CellView) {
        const fromRow = this._data.fromRow
        const toRow = this._data.toRow
        const fromCol = this._data.fromCol
        const toCol = this._data.toCol

        this._rowBorderStore = Array.from({length: toRow - fromRow + 2}, () =>
            Array.from({length: toCol - fromCol + 2}, () => initBorderSegment())
        )

        this._colBorderStore = Array.from({length: toCol - fromCol + 2}, () =>
            Array.from({length: toRow - fromRow + 2}, () => initBorderSegment())
        )

        this._data.cells.concat(this._data.mergeCells).forEach((cell) => {
            const borderInfo = cell.info?.style?.border
            const left = borderInfo?.left
            const right = borderInfo?.right
            const top = borderInfo?.top
            const bottom = borderInfo?.bottom
            const {startRow, endRow, startCol, endCol} = cell.coordinate

            const {
                startRow: posStartRow,
                endRow: posEndRow,
                startCol: posStartCol,
                endCol: posEndCol,
            } = cell.position

            for (let j = startCol; j <= endCol; j++) {
                const topSeg: BorderSegment = {
                    pr: top,
                    from: posStartCol,
                    to: posEndCol,
                    start: posStartRow,
                    coordinateX: endCol,
                    coordinateY: endRow,
                }
                this._setRowBorder(startRow - fromRow, j - fromCol, topSeg)
                const bottomSeg: BorderSegment = {
                    pr: bottom,
                    from: posStartCol,
                    to: posEndCol,
                    start: posEndRow,
                    coordinateX: endCol,
                    coordinateY: endRow,
                }
                this._setRowBorder(endRow - fromRow + 1, j - fromCol, bottomSeg)
            }
            for (let i = startRow; i <= endRow; i++) {
                const leftSeg: BorderSegment = {
                    pr: left,
                    from: posStartRow,
                    to: posEndRow,
                    start: posStartCol,
                    coordinateX: endCol,
                    coordinateY: endRow,
                }
                this._setColBorder(i - fromRow, startCol - fromCol, leftSeg)
                const rightSeg: BorderSegment = {
                    pr: right,
                    from: posStartRow,
                    to: posEndRow,
                    start: posEndCol,
                    coordinateX: endCol,
                    coordinateY: endRow,
                }
                this._setColBorder(i - fromRow, endCol - fromCol + 1, rightSeg)
            }
        })
    }

    public generateRowBorder(row: number): BorderSegment[] {
        const result: BorderSegment[] = []
        let currBorder = this._rowBorderStore[row][0]
        if (!currBorder.pr) {
            currBorder.pr = getDefaultBorder(true)
        }
        for (let i = 1; i < this._rowBorderStore[row].length; i++) {
            const seg = this._rowBorderStore[row][i]
            if (!seg.pr) {
                seg.pr = getDefaultBorder(true)
            }
            const pr = seg.pr as BorderPr
            const currPr = currBorder.pr ?? getDefaultBorder(true)
            if (!isSameBorder(pr, currPr)) {
                result.push(currBorder)
                currBorder = seg
            } else if (currBorder.to < seg.to) {
                currBorder.to = seg.to
            }
        }
        result.push(currBorder)
        return result
    }

    public generateColBorder(col: number) {
        const result: BorderSegment[] = []
        let currBorder = this._colBorderStore[col][0]
        if (!currBorder.pr) {
            currBorder.pr = getDefaultBorder(false)
        }
        for (let i = 1; i < this._colBorderStore[col].length; i++) {
            const seg = this._colBorderStore[col][i]
            if (!seg.pr) {
                seg.pr = getDefaultBorder(false)
            }
            const pr = seg.pr
            // We know that the border is not none, so we can safely cast it to BorderPr
            const currPr = currBorder.pr as BorderPr
            if (!isSameBorder(pr, currPr)) {
                result.push(currBorder)
                currBorder = seg
            } else if (currBorder.to < seg.to) {
                currBorder.to = seg.to
            }
        }
        result.push(currBorder)
        return result
    }

    private _setRowBorder(row: number, col: number, border: BorderSegment) {
        const prev = this._rowBorderStore[row][col]
        if (!prev.pr || prev.pr.style === 'none') {
            this._rowBorderStore[row][col] = border
            return
        } else if (!border.pr || border.pr.style === 'none') {
            return
        }
        if (
            border.coordinateX >= prev.coordinateX &&
            border.coordinateY >= prev.coordinateY
        ) {
            this._rowBorderStore[row][col] = border
            return
        }
    }

    private _setColBorder(row: number, col: number, border: BorderSegment) {
        const prev = this._colBorderStore[col][row]
        if (!prev.pr || prev.pr.style === 'none') {
            this._colBorderStore[col][row] = border
            return
        } else if (!border.pr || border.pr?.style === 'none') {
            return
        }
        if (
            border.coordinateX >= prev.coordinateX &&
            border.coordinateY >= prev.coordinateY
        ) {
            this._colBorderStore[col][row] = border
            return
        }
    }

    private _rowBorderStore!: BorderSegment[][]
    private _colBorderStore!: BorderSegment[][]
}

function getDefaultBorder(horizontal: boolean): BorderPr {
    if (horizontal && SETTINGS.grid.showHorizontal) {
        return {
            color: {red: 107, green: 114, blue: 128},
            style: 'thin',
        }
    }

    if (!horizontal && SETTINGS.grid.showVertical) {
        return {
            color: {red: 107, green: 114, blue: 128},
            style: 'thin',
        }
    }

    return {
        color: undefined,
        style: 'none',
    }
}

export interface BorderSegment {
    pr: BorderPr | undefined
    from: number
    to: number
    start: number
    coordinateX: number
    coordinateY: number
}

function isSameBorder(a: BorderPr, b: BorderPr): boolean {
    return (
        a.style === b.style &&
        a.color?.red === b.color?.red &&
        a.color?.green === b.color?.green &&
        a.color?.blue === b.color?.blue
    )
}

function initBorderSegment(): BorderSegment {
    return {
        pr: undefined,
        from: 0,
        to: 0,
        start: 0,
        coordinateX: 0,
        coordinateY: 0,
    }
}
