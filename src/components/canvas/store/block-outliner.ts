import {action, makeObservable, observable} from 'mobx'
import {CanvasStore} from './store'
import {BlockDisplayInfo} from 'logisheets-web'
import {BlockOutlinerProps} from '@/components/block-outliner'
import {ptToPx, widthToPx} from '@/core'
import {LeftTop} from '@/core/settings'
import {
    xForColEnd,
    xForColStart,
    yForRowEnd,
    yForRowStart,
} from '../grid_helper'
import type {Grid} from '@/core/worker/types'

export class BlockOutliner {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }

    blockInfos: readonly BlockDisplayInfo[] = []

    @action
    updateBlockInfos(grid: Grid) {
        if (!grid.blockInfos) return
        this.blockInfos = grid.blockInfos

        const firstCol = grid.columns[0]?.idx ?? 0
        const lastCol = grid.columns[grid.columns.length - 1]?.idx ?? firstCol
        const firstRow = grid.rows[0]?.idx ?? 0
        const lastRow = grid.rows[grid.rows.length - 1]?.idx ?? firstRow

        this.props = this.blockInfos
            .map((info) => {
                // Compute from block indices instead of absolute positions
                const startCol = Math.max(firstCol, info.info.colStart)
                const endCol = Math.min(
                    lastCol,
                    info.info.colStart + info.info.colCnt - 1
                )
                const startRow = Math.max(firstRow, info.info.rowStart)
                const endRow = Math.min(
                    lastRow,
                    info.info.rowStart + info.info.rowCnt - 1
                )

                // Out of view
                if (startCol > endCol || startRow > endRow) return null

                const startX = xForColStart(startCol, grid)
                const endX = xForColEnd(endCol, grid)
                const startY = yForRowStart(startRow, grid)
                const endY = yForRowEnd(endRow, grid)

                // Match selector convention: -1 offset on origin, width/height = end - start
                const x = LeftTop.width + startX - 1
                const y = LeftTop.height + startY - 1
                const width = Math.max(0, endX - startX + 1)
                const height = Math.max(0, endY - startY + 1)

                const props = new BlockOutlinerProps()
                props.x = x
                props.y = y
                props.width = width
                props.height = height
                props.blockId = info.info.blockId
                props.sheetId = info.info.sheetId
                return props
            })
            .filter((v): v is BlockOutlinerProps => v !== null)
    }

    @observable
    props: BlockOutlinerProps[] = []
}
