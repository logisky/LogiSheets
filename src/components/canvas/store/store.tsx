import { makeAutoObservable } from 'mobx'
import { Subject } from 'rxjs'
export type EventType = keyof HTMLElementEventMap | 'type' | 'render' | 'yScroll' | 'xScroll'
export class CanvasStore {
    constructor() {
        makeAutoObservable(this)
    }
    emit = (type: EventType, args: any) => {
        this._event.next({ type, args })
    }
    obs = () => {
        return this._event.asObservable()
    }
    resizing = false
    dnding = false
    canvas?: HTMLCanvasElement
    setCanvas (canvasEl: HTMLCanvasElement) {
        this.canvas = canvasEl
    }
    setResizing (resizing: boolean) {
        this.resizing = resizing
    }
    setDnd (dnding: boolean) {
        this.dnding = dnding
    }
    private _event = new Subject<{ type: EventType, args: any }>()
}
export const canvasStore = new CanvasStore()