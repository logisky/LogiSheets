import {CanvasAttr} from './canvas_attr'
import {dpr, npx, npxLine} from './utils'
import {useToast} from '@/ui/notification/useToast'

export class CanvasApi {
    canvas() {
        return this._canvas
    }

    setLineDash(segments: number[]) {
        this._ctx.setLineDash(segments)
    }

    attr(attr: CanvasAttr) {
        if (attr.direction) this._ctx.direction = attr.direction
        if (attr.fillStyle) this._ctx.fillStyle = attr.fillStyle
        if (attr.font) {
            this._ctx.font = attr.font.toCssFont()
            this._ctx.fillStyle = attr.font.standardColor.css()
        }
        if (attr.lineWidth) this._ctx.lineWidth = attr.lineWidth
        if (attr.strokeStyle) this._ctx.strokeStyle = attr.strokeStyle
        if (attr.textAlign) this._ctx.textAlign = attr.textAlign
        if (attr.textBaseAlign) this._ctx.textBaseline = attr.textBaseAlign
    }

    paste(newCanvas: HTMLCanvasElement): void {
        this._ctx.drawImage(newCanvas, 0, 0)
    }

    clear(canvas?: HTMLCanvasElement) {
        const c = canvas ?? this._canvas
        if (!c) throw Error('canvas not found')
        const ctx = c.getContext('2d')
        if (!ctx) throw Error('ctx not found')
        ctx.clearRect(0, 0, c.width, c.height)
    }

    /**
     * How to draw HiDPI canvas.
     * https://www.html5rocks.com/en/tutorials/canvas/hidpi/
     */
    setupCanvas(canvas?: HTMLCanvasElement, width?: number, height?: number) {
        const c = canvas ?? this._canvas
        if (!c) throw Error('please set a html canvas element')
        this._canvas = c
        this.clear(canvas)
        const w = width ?? c.getBoundingClientRect().width
        const h = height ?? c.getBoundingClientRect().height
        c.width = w * dpr()
        c.height = h * dpr()
        const ctx = c.getContext('2d')
        if (!ctx) {
            useToast().toast('Unexpected error, please refresh website!')
            return
        }
        ctx.scale(dpr(), dpr())
        this._ctx = ctx
    }

    eraseLine(
        x: number,
        y: number,
        len: number,
        lineWidth: number,
        position: 'v' | 'h'
    ): void {
        this._ctx.save()
        const w = position === 'h' ? len : lineWidth
        const h = position === 'h' ? lineWidth : len
        position === 'h'
            ? this._ctx.clearRect(npxLine(x), npxLine(y) - lineWidth, w, h + 1)
            : this._ctx.clearRect(npxLine(x) - lineWidth, npxLine(y), w + 1, h)
        this._ctx.restore()
    }

    save() {
        this._ctx.save()
    }

    restore() {
        this._ctx.restore()
    }

    translate(x: number, y: number) {
        this._ctx.translate(x, y)
    }

    fillRect(x: number, y: number, w: number, h: number) {
        this._ctx.fillRect(x, y, w, h)
    }

    strokeRect(x: number, y: number, w: number, h: number) {
        this._ctx.strokeRect(this._npxLine(x), this._npxLine(y), w, h)
    }

    line(
        [start, ...points]: readonly (readonly [number, number])[],
        close?: boolean
    ) {
        if (points.length === 0) return
        this._ctx.beginPath()
        this._ctx.moveTo(this._npxLine(start[0]), this._npxLine(start[1]))
        points.forEach((point) => {
            this._ctx.lineTo(this._npxLine(point[0]), this._npxLine(point[1]))
        })
        if (close) this._ctx.closePath()
        this._ctx.stroke()
    }

    protected scale(x: number, y: number) {
        this._ctx.scale(x, y)
    }

    protected fillText(text: string, x: number, y: number) {
        this._ctx.fillText(text, npx(x), npx(y))
    }
    private _ctx!: CanvasRenderingContext2D
    private _canvas?: HTMLCanvasElement
    // https://usefulangle.com/post/17/html5-canvas-drawing-1px-crisp-straight-lines
    private _npxLine(px: number) {
        const offset = this._ctx.lineWidth % 2 === 0 ? 0 : 0.5
        return npx(px) + offset
    }
}
