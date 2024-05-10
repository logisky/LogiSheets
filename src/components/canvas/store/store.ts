import {Backend, DataService, RenderCell, SheetService} from '@/core/data'
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

export class CanvasStore {
    constructor(
        public readonly sheetSvc: SheetService,
        public readonly dataSvc: DataService,
        public readonly backendSvc: Backend
    ) {
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

    render: Render
    resizer: Resizer
    highlights: Highlights
    selector: Selector
    dnd: Dnd
    scrollbar: ScrollBar
    textarea: Textarea
    reset() {
        this.highlights.reset()
        this.selector.reset()
        this.dnd.reset()
        this.textarea.reset()
    }

    match(clientX: number, clientY: number) {
        const viewRange = this.dataSvc.cachedViewRange
        return match(clientX, clientY, this.render.canvas, viewRange)
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
        const viewRange = this.dataSvc.cachedViewRange
        if (startCell.type === 'FixedLeftHeader')
            renderCell = viewRange.rows.find((r) =>
                r.coordinate.cover(startCell.coordinate)
            )
        else if (startCell.type === 'FixedTopHeader')
            renderCell = viewRange.cols.find((c) =>
                c.coordinate.cover(startCell.coordinate)
            )
        else if (startCell.type === 'Cell')
            renderCell = viewRange.cells.find((c) =>
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
}

// @ts-expect-error init data when use
export const CanvasStoreContext = createContext<CanvasStore>({})
