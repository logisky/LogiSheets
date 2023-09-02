import {makeAutoObservable} from 'mobx'
export interface IRange {
    x: number
    y: number
    width: number
    height: number
    draggingX: number
    draggingY: number
}
export class Range implements IRange {
    x = -1
    y = -1
    width = -1
    height = -1
    draggingX = -1
    draggingY = -1
}
export class DndStore {
    constructor() {
        makeAutoObservable(this)
    }
    range?: IRange
    dragging = false
}
export const dndStore = new DndStore()