import {LeftTop} from '@/core/settings'
import {Rect} from './types'
import {CellView, CellViewResponse} from '@/core/data'

/**
 * OffscreenCanvas draws cells without rows and columns.
 */
export class OffscreenCanvas {
    public constructor() {
        this._canvas.width = 2000
        this._canvas.height = 5000
        this._canvas.style.width = '2000px'
        this._canvas.style.height = '5000px'
    }

    /**
     * It is callers' responsibility to make sure cells have been prepared
     * in offscreen canvas.
     */
    public drawCellsToMain(mainCanvas: HTMLCanvasElement, target: Rect) {
        const x = target.x - this._current.x
        const y = target.y - this._current.y
        const mainCtx = mainCanvas.getContext('2d')
        if (!mainCtx) {
            throw Error('main canvas context should not be undefined')
        }

        mainCtx.drawImage(
            this.canvas,
            x,
            y,
            target.width,
            target.height,
            LeftTop.width,
            LeftTop.height,
            target.width,
            target.height
        )
    }

    public currentData() {
        return this._currentData
    }

    public setCurrentData(v: CellView) {
        this._currentData = v
    }

    public drawCells(
        response: CellViewResponse,
        f: (canvas: HTMLCanvasElement, resp: CellViewResponse) => void
    ) {
        const req = response.request
        this._current.x = Math.max(req.startX, 0)
        this._current.y = Math.max(req.startY, 0)
        this._current.height = req.height
        this._current.width = req.width
        this._currentData = response.data

        f(this._canvas, response)
    }

    public get canvas() {
        return this._canvas
    }

    private _canvas = document.createElement('canvas')

    private _current: Rect = {x: 0, y: 0, height: 0, width: 0}
    private _currentData = new CellView([])
}

function decideRenderStrategy(old: Rect, now: Rect): RenderStrategy {
    if (old.height == 0 || old.width == 0) return RenderStrategy.TOTAL
    if (nearlySame(old.y, now.y, 1))
        return old.y < now.y
            ? RenderStrategy.ScrollingDown
            : RenderStrategy.ScrollingUp
    if (nearlySame(old.x, now.x, 1))
        return old.x < now.x
            ? RenderStrategy.ScrollingRight
            : RenderStrategy.ScrollingLeft
    return RenderStrategy.TOTAL
}

function nearlySame(a: number, b: number, epsilon: number): boolean {
    return Math.abs(a - b) < epsilon
}

const enum RenderStrategy {
    ScrollingRight,
    ScrollingLeft,
    ScrollingUp,
    ScrollingDown,
    TOTAL,
}
