import {action, makeObservable, observable} from 'mobx'
import {createContext, type MouseEvent} from 'react'
import {Cell} from '../defs'
import {Textarea} from './textarea'
import {DataServiceImpl as DataService, BlockManager} from '@/core/data'
import {Range} from '@/core/standable'
import {LeftTop} from '@/core/settings'
import {ErrorMessage, isErrorMessage} from 'logisheets-web'
import {Grid} from '@/core/worker/types'

export class CanvasStore {
    constructor(
        public readonly dataSvc: DataService,
        public readonly blockManager: BlockManager
    ) {
        makeObservable(this)
        this.textarea = new Textarea(this)
    }
    // TODO: remove this
    @observable.ref
    startCell?: Cell
    endCell?: Cell

    type?: 'mousedown' | 'contextmenu'
    /**
     * left mousedown the same cell
     */
    same = false

    textarea: Textarea

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

    async render(): Promise<Grid | ErrorMessage> {
        return this.dataSvc
            .render(this.currentSheetId, this.anchorX, this.anchorY)
            .then((g) => {
                if (isErrorMessage(g)) return g
                this.setAnchor(g.anchorX, g.anchorY)
                return g
            })
    }

    async renderWithAnchor(
        anchorX: number,
        anchorY: number
    ): Promise<Grid | ErrorMessage> {
        return this.dataSvc
            .render(this.currentSheetId, anchorX, anchorY)
            .then((g) => {
                if (isErrorMessage(g)) return g
                this.setAnchor(g.anchorX, g.anchorY)
                return g
            })
    }

    reset() {
        this.textarea.reset()
    }

    getCanvasSize!: () => DOMRectReadOnly

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
