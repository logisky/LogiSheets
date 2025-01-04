import {action, makeObservable, observable} from 'mobx'
import {CanvasStore} from './store'
import {RenderCell} from '@/core/data'
import {Range} from '@/core/standable'
import {pxToPt, pxToWidth} from '@/core'
import {
    SetColWidthBuilder,
    SetRowHeightBuilder,
    Transaction,
} from 'logisheets-web'
import {isErrorMessage} from 'packages/web/src/api/utils'
import {getOffset} from '../defs'

interface ResizerProps {
    readonly range: Range
    readonly isRow: boolean
    readonly cell: RenderCell
}
const RESIZER_SIZE = 6

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
        const rowResizers = data.rows.map((c) => {
            const cell = this.store.convertToCanvasPosition(
                c.position,
                'FixedLeftHeader'
            )
            return {
                range: new Range()
                    .setStartRow(cell.endRow - RESIZER_SIZE)
                    .setEndRow(cell.endRow + RESIZER_SIZE)
                    .setStartCol(cell.startCol)
                    .setEndCol(cell.endCol),
                isRow: true,
                cell: c,
            }
        })
        const colResizers = data.cols.map((c) => {
            const cell = this.store.convertToCanvasPosition(
                c.position,
                'FixedTopHeader'
            )
            return {
                range: new Range()
                    .setStartCol(cell.endCol - RESIZER_SIZE)
                    .setStartRow(cell.startRow)
                    .setEndCol(cell.endCol + RESIZER_SIZE)
                    .setEndRow(cell.endRow),
                isRow: false,
                cell: c,
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
        const i = this.resizers.findIndex((r) => {
            return r.range.cover(mousedownRange)
        })
        if (i === -1) return false
        const activeResizer = this.resizers[i]
        if (!activeResizer) return false
        this.movingStart = {x: e.clientX, y: e.clientY}
        const info = activeResizer.isRow
            ? activeResizer.cell.height
            : activeResizer.cell.width
        const result = Math.round(info * 10) / 10
        this.hoverText = `${result}px`
        this.active = activeResizer
        this.moving = {x: 0, y: 0}
        return true
    }

    @action
    mousemove(e: MouseEvent) {
        if (!this.active || !this.movingStart) return false
        const {
            isRow,
            cell: {
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
                cell: {coordinate: coodinate, width, height},
            } = this.active
            const payload = !isRow
                ? new SetColWidthBuilder()
                      .sheetIdx(this.store.currSheetIdx)
                      .col(coodinate.startCol)
                      .width(pxToWidth(this.moving.x + width))
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
