import {action, makeObservable, observable} from 'mobx'
import {createContext, type MouseEvent} from 'react'
import {Resizer} from './resizer'
import {Highlights} from './highlights'
import {Cell, CellType, getOffset, match} from '../defs'
import {Selector} from './selector'
import {Dnd} from './dnd'
import {ScrollBar} from './scrollbar'
import {Textarea} from './textarea'
import {RenderCell, DataService, CellViewData, CellView} from '@/core/data'
import {Range} from '@/core/standable'
import {LeftTop} from '@/core/settings'
import {Renderer} from './renderer/renderer'

export class CanvasStore {
    constructor(public readonly dataSvc: DataService) {
        makeObservable(this)
        this.renderer = new Renderer(this)
        this.resizer = new Resizer(this)
        this.highlights = new Highlights(this)
        this.selector = new Selector(this)
        this.dnd = new Dnd(this)
        this.scrollbar = new ScrollBar(this)
        this.textarea = new Textarea(this)
    }
    @observable.ref
    startCell?: Cell
    endCell?: Cell

    type?: 'mousedown' | 'contextmenu'
    /**
     * left mousedown the same cell
     */
    same = false

    renderer: Renderer
    resizer: Resizer
    highlights: Highlights
    selector: Selector
    dnd: Dnd
    scrollbar: ScrollBar
    textarea: Textarea

    get currSheetIdx() {
        return this.dataSvc.getCurrentSheetIdx()
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

    getCurrentCellView(): CellView {
        return this.renderer.getCurrentData()
    }

    reset() {
        this.highlights.reset()
        this.selector.reset()
        this.dnd.reset()
        this.textarea.reset()
    }

    match(clientX: number, clientY: number) {
        const {x, y} = getOffset(clientX, clientY, this.renderer.canvas)
        const cellView = this.getCurrentCellView()
        return match(x, y, this.anchorX, this.anchorY, cellView.data)
    }

    convertToCanvasPosition(p: Range, ty: CellType): Range {
        if (ty === 'LeftTop') return p

        const canvas = this.renderer.canvas
        const rect = canvas.getBoundingClientRect()

        const convertX = (a: number) => {
            return a - this.anchorX + LeftTop.width
        }

        const convertY = (a: number) => {
            return a - this.anchorY + LeftTop.height
        }

        if (ty === 'FixedLeftHeader') {
            return new Range()
                .setStartRow(convertY(p.startRow))
                .setEndRow(convertY(p.endRow))
                .setStartCol(0)
                .setEndCol(LeftTop.width)
        }
        if (ty === 'FixedTopHeader')
            return new Range()
                .setStartRow(0)
                .setEndRow(LeftTop.height)
                .setStartCol(convertX(p.startCol))
                .setEndCol(convertX(p.endCol))

        const startX = convertX(p.startCol)
        const endX = convertX(p.endCol)

        const startY = convertY(p.startRow)
        const endY = convertY(p.endRow)

        return new Range()
            .setEndCol(endX)
            .setStartCol(startX)
            .setEndRow(endY)
            .setStartRow(startY)
    }

    @action
    keydown(e: KeyboardEvent, cell: Cell) {
        this.startCell = cell
    }

    @action
    mousedown(e: MouseEvent, cell: Cell) {
        this.startCell = cell
        this.type = 'mousedown'
        this.same = this.startCell && cell.equals(this.startCell)
        this.selector.onMouseDown()
        this.textarea.mousedown(e.nativeEvent)
    }

    @action
    contextmenu(e: MouseEvent, cell: Cell) {
        this.startCell = cell
        this.type = 'contextmenu'
        this.same = this.startCell && cell.equals(this.startCell)
        this.selector.onContextmenu(cell)
    }

    @action
    scroll() {
        const startCell = this.startCell
        if (!startCell) return
        if (startCell.type === 'LeftTop' || startCell.type === 'unknown') return
        let renderCell: RenderCell | undefined
        const cellView = this.getCurrentCellView()
        if (startCell.type === 'FixedLeftHeader')
            renderCell = cellView.rows.find((r) =>
                r.coordinate.cover(startCell.coordinate)
            )
        else if (startCell.type === 'FixedTopHeader')
            renderCell = cellView.cols.find((c) =>
                c.coordinate.cover(startCell.coordinate)
            )
        else if (startCell.type === 'Cell')
            renderCell = cellView.cells.find((c) =>
                c.coordinate.cover(startCell.coordinate)
            )
        else return
        if (!renderCell) {
            this.reset()
            return
        }
        const newStartCell = new Cell(startCell.type).copyByRenderCell(
            renderCell
        )
        this.same = true
        this.selector.onScroll(newStartCell)
    }

    private _sheetAnchorData = new Map<
        number,
        {anchorX: number; anchorY: number}
    >()
}

// @ts-expect-error init data when use
export const CanvasStoreContext = createContext<CanvasStore>({})
