import { Cell } from '@/components/canvas'
import {makeAutoObservable} from 'mobx'
import { MouseEvent, WheelEvent } from 'react'
import { CustomScrollEvent } from '@/components/scrollbar'
export interface StartCellInfo {
    e: MouseEvent | WheelEvent | CustomScrollEvent
    changed: boolean
    scroll?: boolean
}
export class SelectorStore {
    constructor() {
        makeAutoObservable(this, {}, {autoBind: true})
    }
    editing = false
    startCell = new Cell('unknown')
    endCell = new Cell('unknown')
    startCellInfo?: StartCellInfo
    setCells(start: Cell, info: StartCellInfo, end: Cell) {
        this.startCell = start
        this.endCell = end
        this.startCellInfo = info
    }
    reset() {
        this.startCell = new Cell('unknown')
        this.endCell = new Cell('unknown')
        this.startCellInfo = undefined
    }
}
export const selectorStore = new SelectorStore()