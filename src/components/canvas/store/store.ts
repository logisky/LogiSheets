import {action, makeObservable, observable} from 'mobx'
import {createContext, type MouseEvent} from 'react'
import {Render} from './render'
import {Resizer} from './resizer'
import {Highlights} from './highlights'
import {Cell, match} from '../defs'
import {Selector} from './selector'
import {Dnd} from './dnd'
import {ScrollBar} from './scrollbar'
import {Textarea} from './textarea'
import {RenderCell, DataService, CellViewData} from '@/core/data2'

export class CanvasStore {
    constructor(public readonly dataSvc: DataService) {
        makeObservable(this)
        this.render = new Render(this)
        this.resizer = new Resizer(this)
        this.highlights = new Highlights(this)
        this.selector = new Selector(this)
        this.dnd = new Dnd(this)
        this.scrollbar = new ScrollBar(this)
        this.textarea = new Textarea(this)
    }
    @observable.ref
    startCell?: Cell

    type?: 'mousedown' | 'contextmenu'
    /**
     * left mousedown the same cell
     */
    same = false
    currSheetIdx = 0

    render: Render
    resizer: Resizer
    highlights: Highlights
    selector: Selector
    dnd: Dnd
    scrollbar: ScrollBar
    textarea: Textarea

    getCurrentCellView(): readonly CellViewData[] {
        return this.dataSvc.getCurrentCellView(this.currSheetIdx)
    }
    reset() {
        this.highlights.reset()
        this.selector.reset()
        this.dnd.reset()
        this.textarea.reset()
    }

    match(clientX: number, clientY: number) {
        const data = this.getCurrentCellView()
        return match(clientX, clientY, this.render.canvas, data)
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
            renderCell = cellView
                .flatMap((d) => d.rows)
                .find((r) => r.coordinate.cover(startCell.coordinate))
        else if (startCell.type === 'FixedTopHeader')
            renderCell = cellView
                .flatMap((d) => d.cols)
                .find((c) => c.coordinate.cover(startCell.coordinate))
        else if (startCell.type === 'Cell')
            renderCell = cellView
                .flatMap((d) => d.cells)
                .find((c) => c.coordinate.cover(startCell.coordinate))
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
}

// @ts-expect-error init data when use
export const CanvasStoreContext = createContext<CanvasStore>({})
