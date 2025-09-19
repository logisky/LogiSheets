import {action, makeObservable, observable} from 'mobx'
import {CanvasStore} from './store'
import {StandardColor, Range} from '@/core/standable'
import {getHighlightColor} from '@/components/const'
import {CellRef} from 'logisheets-web'

export class HighlightCellStyle {
    bgColor = new StandardColor()
    x: number = 0
    y: number = 0
    width: number = 0
    height: number = 0
}

export interface HighlightCell {
    readonly rowStart?: number
    readonly colStart?: number
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

    @observable
    cellRefs: readonly CellRef[] = []

    @action
    reset() {
        this.highlightCells = []
    }

    @action
    updateCellRefs(cellRefs: readonly CellRef[]) {
        this.cellRefs = cellRefs
        this.render()
    }

    @action
    render() {
        let i = 0
        const newCells: HighlightCell[] = []
        const findCell = (row: number, col: number) => {
            const viewRange = this.store.getCurrentCellView()
            const cell = viewRange.cells.find((c) => {
                const range = new Range()
                    .setStartCol(col)
                    .setStartRow(row)
                    .setEndCol(col)
                    .setEndRow(row)
                return c.coordinate.cover(range)
            })
            return cell
        }
        const findRow = (row: number) => {
            const viewRange = this.store.getCurrentCellView()
            const cell = viewRange.rows.find((c) => {
                const range = new Range().setStartRow(row).setEndRow(row)
                return c.coordinate.cover(range)
            })
            return cell
        }
        const findCol = (col: number) => {
            const viewRange = this.store.getCurrentCellView()
            const cell = viewRange.cols.find((c) => {
                const range = new Range().setStartCol(col).setEndCol(col)
                return c.coordinate.cover(range)
            })
            return cell
        }

        const rect = this.store.renderer.canvas.getBoundingClientRect()
        const maxH = rect.height
        const maxW = rect.width

        this.cellRefs.forEach((cellRef) => {
            if (cellRef.workbook) return
            if (cellRef.sheet1 !== undefined && cellRef.sheet2 !== undefined)
                return

            const currSheetName = this.store.dataSvc.getCurrentSheetName()
            if (cellRef.sheet1 && cellRef.sheet1 !== currSheetName) return

            const color = getHighlightColor(i)
            i++

            const newCell = {
                rowStart: cellRef.row1,
                colStart: cellRef.col1,
                rowEnd: cellRef.row2,
                colEnd: cellRef.col2,
                style: new HighlightCellStyle(),
            }
            if (cellRef.row1 !== undefined && cellRef.col1 !== undefined) {
                const startCell = findCell(cellRef.row1, cellRef.col1)
                if (cellRef.row2 !== undefined && cellRef.col2 !== undefined) {
                    const endCell = findCell(cellRef.row2, cellRef.col2)
                    if (startCell && endCell) {
                        const startPosition =
                            this.store.convertToMainCanvasPosition(
                                startCell.position,
                                'Cell'
                            )
                        const endPosition =
                            this.store.convertToMainCanvasPosition(
                                endCell.position,
                                'Cell'
                            )
                        const startCol = Math.min(
                            startPosition.startCol,
                            endPosition.startCol
                        )
                        const endCol = Math.max(
                            startPosition.endCol,
                            endPosition.endCol
                        )
                        const startRow = Math.min(
                            startPosition.startRow,
                            endPosition.startRow
                        )
                        const endRow = Math.max(
                            startPosition.endRow,
                            endPosition.endRow
                        )
                        newCell.style = {
                            bgColor: color,
                            x: startCol,
                            y: startRow,
                            width: endCol - startCol,
                            height: endRow - startRow,
                        }
                        newCells.push(newCell)
                    } else if (startCell !== undefined) {
                        const startPosition =
                            this.store.convertToMainCanvasPosition(
                                startCell.position,
                                'Cell'
                            )
                        newCell.style = {
                            bgColor: color,
                            x: startPosition.startCol,
                            y: startPosition.startRow,
                            width: maxW,
                            height: maxH,
                        }
                        newCells.push(newCell)
                    } else if (endCell !== undefined) {
                        const endPosition =
                            this.store.convertToMainCanvasPosition(
                                endCell.position,
                                'Cell'
                            )
                        newCell.style = {
                            bgColor: color,
                            x: 0,
                            y: 0,
                            width: endPosition.endCol,
                            height: endPosition.endRow,
                        }
                        newCells.push(newCell)
                    }
                } else if (startCell !== undefined) {
                    const startPosition =
                        this.store.convertToMainCanvasPosition(
                            startCell.position,
                            'Cell'
                        )
                    newCell.style = {
                        bgColor: color,
                        x: startPosition.startCol,
                        y: startPosition.startRow,
                        width: startPosition.width,
                        height: startPosition.height,
                    }
                    newCells.push(newCell)
                }
                return
            }

            if (cellRef.row1 !== undefined) {
                const startRow = findRow(cellRef.row1)
                if (cellRef.row2 !== undefined) {
                    const endRow = findRow(cellRef.row2)
                    if (startRow !== undefined && endRow !== undefined) {
                        const startPosition =
                            this.store.convertToMainCanvasPosition(
                                startRow.position,
                                'FixedLeftHeader'
                            )
                        const endPosition =
                            this.store.convertToMainCanvasPosition(
                                endRow.position,
                                'FixedLeftHeader'
                            )
                        const start = Math.min(
                            startPosition.startRow,
                            endPosition.startRow
                        )
                        const end = Math.max(
                            startPosition.endRow,
                            endPosition.endRow
                        )
                        newCell.style = {
                            bgColor: color,
                            x: 0,
                            y: start,
                            width: maxW,
                            height: end - start,
                        }
                        newCells.push(newCell)
                    } else if (endRow !== undefined) {
                        const endPosition =
                            this.store.convertToMainCanvasPosition(
                                endRow.position,
                                'FixedLeftHeader'
                            )
                        newCell.style = {
                            bgColor: color,
                            x: 0,
                            y: 0,
                            width: maxW,
                            height: endPosition.endRow,
                        }
                        newCells.push(newCell)
                    } else if (startRow !== undefined) {
                        const startPosition =
                            this.store.convertToMainCanvasPosition(
                                startRow.position,
                                'FixedLeftHeader'
                            )
                        newCell.style = {
                            bgColor: color,
                            x: 0,
                            y: startPosition.startRow,
                            width: maxW,
                            height: startPosition.height,
                        }
                        newCells.push(newCell)
                    }
                } else if (startRow !== undefined) {
                    const startPosition =
                        this.store.convertToMainCanvasPosition(
                            startRow.position,
                            'FixedLeftHeader'
                        )
                    newCell.style = {
                        bgColor: color,
                        x: 0,
                        y: startPosition.startRow,
                        width: maxW,
                        height: startPosition.height,
                    }
                    newCells.push(newCell)
                }
                return
            }

            if (cellRef.col1 !== undefined) {
                const startCol = findCol(cellRef.col1)
                if (cellRef.col2 !== undefined) {
                    const endCol = findCol(cellRef.col2)
                    if (startCol !== undefined && endCol !== undefined) {
                        const startPosition =
                            this.store.convertToMainCanvasPosition(
                                startCol.position,
                                'FixedTopHeader'
                            )
                        const endPosition =
                            this.store.convertToMainCanvasPosition(
                                endCol.position,
                                'FixedTopHeader'
                            )
                        const start = Math.min(
                            startPosition.startCol,
                            endPosition.startCol
                        )
                        const end = Math.max(
                            startPosition.endCol,
                            endPosition.endCol
                        )
                        newCell.style = {
                            bgColor: color,
                            x: start,
                            y: 0,
                            width: end - start,
                            height: maxH,
                        }
                        newCells.push(newCell)
                    } else if (endCol !== undefined) {
                        const endPosition =
                            this.store.convertToMainCanvasPosition(
                                endCol.position,
                                'FixedTopHeader'
                            )
                        newCell.style = {
                            bgColor: color,
                            x: 0,
                            y: 0,
                            width: endPosition.endCol,
                            height: maxH,
                        }
                        newCells.push(newCell)
                    } else if (startCol !== undefined) {
                        const startPosition =
                            this.store.convertToMainCanvasPosition(
                                startCol.position,
                                'FixedTopHeader'
                            )
                        newCell.style = {
                            bgColor: color,
                            x: startPosition.startCol,
                            y: 0,
                            width: maxW - startPosition.startCol,
                            height: maxH,
                        }
                        newCells.push(newCell)
                    }
                } else if (startCol !== undefined) {
                    const startPosition =
                        this.store.convertToMainCanvasPosition(
                            startCol.position,
                            'FixedTopHeader'
                        )
                    newCell.style = {
                        bgColor: color,
                        x: startPosition.startCol,
                        y: 0,
                        width: startPosition.width,
                        height: maxH,
                    }
                    newCells.push(newCell)
                }
                return
            }

            throw new Error(`Invalid cell reference: ${cellRef}`)
        })
        this.highlightCells = newCells
    }
}
