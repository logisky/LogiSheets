import {action, makeObservable, observable, runInAction} from 'mobx'
import {CanvasStore} from './store'
import {Range} from '@/core/standable'
import type {CellId, CellPosition} from 'packages/web'
import type {SheetId} from 'packages/craft-forge/dist'
import {isErrorMessage} from 'packages/web'
import {ShadowCellProps} from '@/components/shadow-cell'
import {ptToPx, widthToPx} from '@/core'
import {sheetCellIdToString} from '@/core/data/workbook/client'

export class CellValidation {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }

    @observable
    invalidCells: ShadowCellProps[] = []

    @action
    addInvalidCell(
        sheetId: SheetId,
        cellId: CellId,
        startPosition: CellPosition,
        endPosition: CellPosition
    ) {
        if (!this._invalidCellMap.has(sheetId)) {
            this._invalidCellMap.set(sheetId, new Map())
        }
        this._invalidCellMap
            .get(sheetId)
            ?.set(sheetCellIdToString({sheetId, cellId}), [
                startPosition,
                endPosition,
            ])
        this._updateCurrentInvalidCells()
    }

    @action
    removeInvalidCell(sheetId: SheetId, cellId: CellId) {
        this._invalidCellMap
            .get(sheetId)
            ?.delete(sheetCellIdToString({sheetId, cellId}))
        this._updateCurrentInvalidCells()
    }

    @action
    _updateCurrentInvalidCells() {
        this.store.currentSheetId.then((id) => {
            if (isErrorMessage(id)) {
                return
            }
            const invalidCells = this._invalidCellMap.get(id)
            runInAction(() => {
                if (invalidCells) {
                    this.invalidCells = Array.from(
                        invalidCells.values().map((cellPosition) => {
                            const props = new ShadowCellProps()
                            const range =
                                this.store.convertToMainCanvasPosition(
                                    new Range()
                                        .setStartRow(ptToPx(cellPosition[0].y))
                                        .setEndRow(ptToPx(cellPosition[1].y))
                                        .setStartCol(
                                            widthToPx(cellPosition[0].x)
                                        )
                                        .setEndCol(
                                            widthToPx(cellPosition[1].x)
                                        ),
                                    'Cell'
                                )
                            props.x = range.startCol
                            props.y = range.startRow
                            props.width = range.width
                            props.height = range.height
                            return props
                        })
                    )
                } else {
                    this.invalidCells = []
                }
            })
        })
    }

    private _invalidCellMap = new Map<
        SheetId,
        Map<string, [CellPosition, CellPosition]>
    >()
}
