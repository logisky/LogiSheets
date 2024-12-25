import {action, makeObservable, observable} from 'mobx'
import {CanvasStore} from './store'
import {RenderCell} from '@/core/data2'
import {Range} from '@/core/standable'
import {pxToPt} from '@/core'
import {
    SetColWidthBuilder,
    SetRowHeightBuilder,
    Transaction,
} from 'logisheets-web'
import {getOffset} from '../defs'
import {isErrorMessage} from 'packages/web/src/api/utils'

interface ResizerProps {
    readonly range: Range
    readonly isRow: boolean
    readonly leftCell: RenderCell
}
const RESIZER_SIZE = 4

export class Resizer {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }

    @observable
    resizers: ResizerProps[] = []

    @observable
    moving = {x: 0, y: 0}

    @observable
    hoverText = ''

    @observable
    active?: ResizerProps

    @observable
    movingStart?: {x: number; y: number}

    init() {
        const data = this.store.getCurrentCellView()
        const rowResizers = data
            .flatMap((d) => d.rows)
            .map((cell) => {
                return {
                    range: new Range()
                        .setStartRow(cell.position.endRow)
                        .setEndRow(cell.position.endRow + RESIZER_SIZE)
                        .setStartCol(cell.position.startCol)
                        .setEndCol(cell.position.endCol),
                    isRow: true,
                    leftCell: cell,
                }
            })
        const colResizers = data
            .flatMap((d) => d.cols)
            .map((cell) => {
                return {
                    range: new Range()
                        .setStartCol(cell.position.endCol)
                        .setStartRow(cell.position.startRow)
                        .setEndCol(cell.position.endCol + RESIZER_SIZE)
                        .setEndRow(cell.position.endRow),
                    isRow: false,
                    leftCell: cell,
                }
            })
        this.updateResizers(rowResizers.concat(colResizers))
    }

    @action
    mousedown(e: MouseEvent) {
        const canvas = this.store.render.canvas
        const {x, y} = getOffset(e.clientX, e.clientY, canvas)
        const mousedownRange = new Range()
            .setStartRow(y)
            .setEndRow(y)
            .setStartCol(x)
            .setEndCol(x)
        const i = this.resizers.findIndex((r) => r.range.cover(mousedownRange))
        if (i === -1) return false
        const activeResizer = this.resizers[i]
        if (!activeResizer) return false
        this.movingStart = {x: e.clientX, y: e.clientY}
        // const sheet = this.store.dataSvc
        //     .getWorkbook()
        //     .getWorksheet(this.store.currSheetIdx)
        // const {startCol, startRow} = activeResizer.leftCell.coordinate
        // const info = activeResizer.isRow
        //     ? sheet.getRowHeight(startCol)
        //     : sheet.getColWidth(startRow)
        // if (isErrorMessage(info)) {
        //     throw Error(info.msg)
        // }
        // const value = (this.hoverText = `${info}px`)
        this.active = activeResizer
        this.moving = {x: 0, y: 0}
        return true
    }

    @action
    mousemove(e: MouseEvent) {
        if (!this.active || !this.movingStart) return false
        const {
            isRow,
            leftCell: {
                position: {startCol, startRow, endCol, endRow},
            },
        } = this.active
        let px = 0
        if (isRow) {
            const newEndRow = endRow + e.clientY - this.movingStart.y
            if (newEndRow > startRow) px = newEndRow - startRow
        } else {
            const newEndCol = endCol + e.clientX - this.movingStart.x
            if (newEndCol > startCol) px = newEndCol - startCol
        }
        px = parseFloat(px.toFixed(2))
        this.hoverText = `${px}px`
        this.moving = {
            x: isRow ? this.moving.x : px - (endCol - startCol),
            y: !isRow ? this.moving.y : px - (endRow - startRow),
        }
        return true
    }

    @action
    mouseup() {
        if (this.active) {
            const {
                isRow,
                leftCell: {coordinate: coodinate, width, height},
            } = this.active
            const payload = !isRow
                ? new SetColWidthBuilder()
                      .sheetIdx(this.store.currSheetIdx)
                      .col(coodinate.startCol)
                      .width(pxToPt(this.moving.x + width))
                      .build()
                : new SetRowHeightBuilder()
                      .sheetIdx(this.store.currSheetIdx)
                      .row(coodinate.startRow)
                      .height(pxToPt(this.moving.y + height))
                      .build()
            this.store.dataSvc.handleTransaction(
                new Transaction([payload], true)
            )
        }
        this.active = undefined
        this.moving = {x: 0, y: 0}
        this.movingStart = undefined
    }

    @action
    private updateResizers(resizers: ResizerProps[]) {
        this.resizers = resizers
    }
}
