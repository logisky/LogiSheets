import {CellViewResponse, DataService} from '@/core/data'
import {
    Canvas,
    DrawContent,
    IncrementalRenderer,
    IncrementalRendererBuilder,
} from './incremental'
import {Rect} from './types'
import {isErrorMessage} from 'packages/web'
import {dpr} from '@/core/painter/utils'

const HorizontalBuffer = 200
const VerticalBuffer = 1200
const XUnit = 100
const YUnit = 400
const canvasWidth = 1200
const canvasHeight = 3000

export class DrawContentImpl implements DrawContent {
    constructor(public readonly dataView: CellViewResponse) {}

    get x(): number {
        return this.dataView.request.startX
    }

    get y(): number {
        return this.dataView.request.startY
    }
    get width(): number {
        return this.dataView.request.width
    }
    get height(): number {
        return this.dataView.request.height
    }

    getRect(): Rect {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
        }
    }
}

export class CanvasImpl implements Canvas {
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas
        const ctx = canvas.getContext('2d')
        if (ctx === null) {
            throw new Error('Failed to get 2d context')
        }
        // Scale context to DPR so all drawing uses CSS pixel coordinates
        this._ctx = ctx
        const ratio = dpr()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(ratio, ratio)
    }

    get x(): number {
        return this.canvas.offsetLeft
    }

    get y(): number {
        return this.canvas.offsetTop
    }

    getElement(): HTMLCanvasElement {
        return this.canvas
    }

    getRect(): Rect {
        const ratio = dpr()
        return {
            x: 0,
            y: 0,
            width: this.canvas.width / ratio,
            height: this.canvas.height / ratio,
        }
    }

    getSize(): {width: number; height: number} {
        const ratio = dpr()
        return {
            width: this.canvas.width / ratio,
            height: this.canvas.height / ratio,
        }
    }

    setSize(width: number, height: number): void {
        const ratio = dpr()
        // Backing store in device pixels
        this.canvas.width = Math.max(1, Math.floor(width * ratio))
        this.canvas.height = Math.max(1, Math.floor(height * ratio))
        // Reset transform after resize
        this._ctx.setTransform(1, 0, 0, 1, 0, 0)
        this._ctx.scale(ratio, ratio)
    }

    clear(): void {
        this._ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }

    moveImage(
        sx: number,
        sy: number,
        width: number,
        height: number,
        dx: number,
        dy: number
    ): void {
        this._ctx.drawImage(
            this.canvas,
            sx,
            sy,
            width,
            height,
            dx,
            dy,
            width,
            height
        )
    }

    clearRect(rect: Rect): void {
        this._ctx.clearRect(rect.x, rect.y, rect.width, rect.height)
    }

    public canvas: HTMLCanvasElement
    private _ctx: CanvasRenderingContext2D
}

export function createIncrementalCellRenderer(
    dataSvc: DataService,
    drawCellsFn: (
        canvas: HTMLCanvasElement,
        resp: CellViewResponse,
        anchorX: number,
        anchorY: number
    ) => void
): IncrementalRenderer<DrawContentImpl, CanvasImpl> {
    const canvas = document.createElement('canvas')
    const canvasImpl = new CanvasImpl(canvas)
    canvasImpl.setSize(canvasWidth, canvasHeight)
    const fetchData = async (rect: Rect) => {
        const data = dataSvc.getCellView(
            dataSvc.getCurrentSheetIdx(),
            rect.x,
            rect.y,
            rect.height,
            rect.width
        )
        return data.then((d) => {
            if (isErrorMessage(d)) throw Error('failed to fetch')
            return new DrawContentImpl(d)
        })
    }
    const renderFn = (
        canvas: CanvasImpl,
        data: DrawContentImpl,
        anchorX: number,
        anchorY: number
    ) => {
        return drawCellsFn(canvas.canvas, data.dataView, anchorX, anchorY)
    }

    return new IncrementalRendererBuilder<DrawContentImpl, CanvasImpl>()
        .setCanvas(canvasImpl)
        .setFetchData(fetchData)
        .setRender(renderFn)
        .setHorizontalBuffer(HorizontalBuffer)
        .setVerticalBuffer(VerticalBuffer)
        .build()
}

export function createIncrementalRowsRenderer(
    fetchData: (rect: Rect) => Promise<CellViewResponse>,
    drawRowsFn: (
        canvas: HTMLCanvasElement,
        resp: CellViewResponse,
        anchorX: number,
        anchorY: number
    ) => void
): IncrementalRenderer<DrawContentImpl, CanvasImpl> {
    const canvas = document.createElement('canvas')
    const canvasImpl = new CanvasImpl(canvas)
    canvasImpl.setSize(100, canvasHeight)
    const fetchDataFn = async (rect: Rect) => {
        const data = await fetchData(rect)
        if (isErrorMessage(data)) throw Error('failed to fetch')
        return new DrawContentImpl(data)
    }
    const renderFn = (
        canvas: CanvasImpl,
        data: DrawContentImpl,
        anchorX: number,
        anchorY: number
    ) => {
        return drawRowsFn(canvas.canvas, data.dataView, anchorX, anchorY)
    }

    return new IncrementalRendererBuilder<DrawContentImpl, CanvasImpl>()
        .setCanvas(canvasImpl)
        .setFetchData(fetchDataFn)
        .setRender(renderFn)
        .setHorizontalBuffer(10)
        .setVerticalBuffer(VerticalBuffer)
        .build()
}

export function createIncrementalColsRenderer(
    fetchData: (rect: Rect) => Promise<CellViewResponse>,
    drawColsFn: (
        canvas: HTMLCanvasElement,
        resp: CellViewResponse,
        anchorX: number,
        anchorY: number
    ) => void
): IncrementalRenderer<DrawContentImpl, CanvasImpl> {
    const canvas = document.createElement('canvas')
    const canvasImpl = new CanvasImpl(canvas)
    canvasImpl.setSize(canvasWidth, 100)
    const fetchDataFn = async (rect: Rect) => {
        const data = await fetchData(rect)
        if (isErrorMessage(data)) throw Error('failed to fetch')
        return new DrawContentImpl(data)
    }
    const renderFn = (
        canvas: CanvasImpl,
        data: DrawContentImpl,
        anchorX: number,
        anchorY: number
    ) => {
        return drawColsFn(canvas.canvas, data.dataView, anchorX, anchorY)
    }

    return new IncrementalRendererBuilder<DrawContentImpl, CanvasImpl>()
        .setCanvas(canvasImpl)
        .setFetchData(fetchDataFn)
        .setRender(renderFn)
        .setHorizontalBuffer(HorizontalBuffer)
        .setVerticalBuffer(10)
        .build()
}
