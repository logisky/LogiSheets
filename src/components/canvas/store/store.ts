import {action, makeObservable, observable} from 'mobx'
import {createContext, type MouseEvent} from 'react'
import {Cell} from '../defs'
import {Textarea} from './textarea'
import {
    DataServiceImpl as DataService,
    CellView,
    CraftManager,
} from '@/core/data'
import {Range} from '@/core/standable'
import {LeftTop} from '@/core/settings'
import {BlockOutliner} from './block-outliner'
import {DiyButton} from './diy-button'
import {CellValidation} from './cell-validation'
import {isErrorMessage, type FormulaDisplayInfo} from 'logisheets-web'

export class CanvasStore {
    constructor(
        public readonly dataSvc: DataService,
        public readonly craftManager: CraftManager
    ) {
        makeObservable(this)
        this.textarea = new Textarea(this)
        this.blockOutliner = new BlockOutliner(this)
        this.diyButton = new DiyButton(this)
        this.cellValidation = new CellValidation(this)
    }
    @observable.ref
    startCell?: Cell
    endCell?: Cell

    type?: 'mousedown' | 'contextmenu'
    /**
     * left mousedown the same cell
     */
    same = false

    textarea: Textarea
    blockOutliner: BlockOutliner
    diyButton: DiyButton
    cellValidation: CellValidation

    get currSheetIdx() {
        return this.dataSvc.getCurrentSheetIdx()
    }

    get currentSheetId() {
        return this.dataSvc.getCurrentSheetId()
    }

    get anchorX() {
        return this._sheetAnchorData.get(this.currSheetIdx)?.anchorX ?? 0
    }

    get anchorY() {
        return this._sheetAnchorData.get(this.currSheetIdx)?.anchorY ?? 0
    }

    setAnchor(x: number, y: number) {
        const data = this._sheetAnchorData.get(this.currSheetIdx) ?? {
            anchorX: 0,
            anchorY: 0,
        }
        data.anchorX = x
        data.anchorY = y
        this._sheetAnchorData.set(this.currSheetIdx, data)
    }

    render() {
        return this.dataSvc
            .render(this.currentSheetId, this.anchorX, this.anchorY)
            .then((g) => {
                if (isErrorMessage(g)) return
                this.setAnchor(g.anchorX, g.anchorY)
            })
    }

    renderWithAnchor(anchorX: number, anchorY: number) {
        return this.dataSvc
            .render(this.currentSheetId, anchorX, anchorY)
            .then((g) => {
                if (isErrorMessage(g)) return
                this.setAnchor(g.anchorX, g.anchorY)
            })
    }

    reset() {
        this.textarea.reset()
    }

    getCanvasSize!: () => DOMRectReadOnly

    /**
     * Due to the change of column width or row height, selector should be
     * updated
     */
    updateStartAndEndCells(data: CellView) {
        if (!this.startCell) return
        // const data = this.getCurrentCellView()
        const updatePosition = (cell: Cell) => {
            if (cell.type === 'FixedLeftHeader') {
                const newRow = data.rows.find((r) => {
                    return r.coordinate.equals(cell.coordinate)
                })
                if (newRow) cell.position = newRow.position
            } else if (cell.type === 'FixedTopHeader') {
                const newCol = data.cols.find((r) => {
                    return r.coordinate.equals(cell.coordinate)
                })
                if (newCol) cell.position = newCol.position
            } else if (cell.type === 'Cell') {
                const newCell = data.cells.find((r) => {
                    return r.coordinate.equals(cell.coordinate)
                })
                if (newCell) cell.position = newCell.position
            }
        }
        updatePosition(this.startCell)
        if (this.endCell) updatePosition(this.endCell)
    }

    convertToMainCanvasPosition(p: Range): Range {
        return new Range()
            .setEndCol(p.endCol - this.anchorX + LeftTop.width)
            .setStartCol(p.startCol - this.anchorX + LeftTop.width)
            .setEndRow(p.endRow - this.anchorY + LeftTop.height)
            .setStartRow(p.startRow - this.anchorY + LeftTop.height)
    }

    @action
    keydown(e: KeyboardEvent, cell: Cell) {
        this.startCell = cell
    }

    @action
    mousedown(e: MouseEvent, cell: Cell) {
        this.startCell = cell
        this.endCell = undefined
        this.type = 'mousedown'
        this.same = this.startCell && cell.equals(this.startCell)
        if (this.diyButton.mousedown()) return
        this.textarea.mousedown(e.nativeEvent)
    }

    @action
    contextmenu(e: MouseEvent, cell: Cell) {
        this.startCell = cell
        this.type = 'contextmenu'
        this.same = this.startCell && cell.equals(this.startCell)
    }

    private _sheetAnchorData = new Map<
        number,
        {anchorX: number; anchorY: number}
    >()
}

// @ts-expect-error init data when use
export const CanvasStoreContext = createContext<CanvasStore>({})
