import {CanvasAttr} from './canvas_attr'
import {dpr} from './utils'

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

    paste(newCanvas: OffscreenCanvas): void {
        this._ctx.drawImage(newCanvas, 0, 0)
    }

    clear(canvas?: OffscreenCanvas | HTMLCanvasElement) {
        const c = canvas ?? this._canvas
        if (!c) throw Error('canvas not found')
        const ctx = c.getContext('2d')
        if (!ctx) throw Error('ctx not found')
        if (ctx instanceof CanvasRenderingContext2D) {
            ctx.clearRect(0, 0, c.width, c.height)
        }
    }

    /**
     * How to draw HiDPI canvas.
     * https://www.html5rocks.com/en/tutorials/canvas/hidpi/
     */
    setupCanvas(
        canvas?: OffscreenCanvas | HTMLCanvasElement,
        width?: number,
        height?: number
    ) {
        const c = canvas ?? this._canvas
        if (!c) throw Error('please set a html canvas element')
        this._canvas = c
        this.clear(canvas)

        if (c instanceof HTMLCanvasElement) {
            const w = width ?? c.getBoundingClientRect().width
            const h = height ?? c.getBoundingClientRect().height

            // Set physical resolution for HiDPI
            c.width = w * dpr()
            c.height = h * dpr()

            // Set CSS size to maintain logical dimensions
            c.style.width = `${w}px`
            c.style.height = `${h}px`
        }

        const ctx = c.getContext('2d')
        if (!ctx) {
            return
        }
        if (ctx instanceof HTMLCanvasElement) {
            ctx.scale(dpr(), dpr())
        }
        this._ctx = ctx
    }

    /**
     * Prepare the canvas that is going to be drawn on.
     *
     * The caller should be responsible for the validity of canvas
     */
    setCanvas(canvas: OffscreenCanvas | HTMLCanvasElement) {
        this._canvas = canvas
        const ctx = canvas.getContext('2d')
        if (!ctx) {
            return
        }
        this._ctx = ctx
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

    clearRect(x: number, y: number, w: number, h: number) {
        this._ctx.clearRect(x, y, w, h)
    }

    strokeRect(x: number, y: number, w: number, h: number) {
        this._ctx.strokeRect(this._npxLine(x), this._npxLine(y), w, h)
    }

    /**
     * Fill a rounded rectangle using current fillStyle.
     */
    fillRoundedRect(
        x: number,
        y: number,
        w: number,
        h: number,
        radius: number
    ) {
        const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2))
        const ctx = this._ctx
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + w, y, x + w, y + h, r)
        ctx.arcTo(x + w, y + h, x, y + h, r)
        ctx.arcTo(x, y + h, x, y, r)
        ctx.arcTo(x, y, x + w, y, r)
        ctx.closePath()
        ctx.fill()
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
        // Context is DPR-scaled upstream; use CSS pixel coordinates here.
        this._ctx.fillText(text, x, y)
    }
    private _ctx!: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
    private _canvas?: OffscreenCanvas | HTMLCanvasElement
    // https://usefulangle.com/post/17/html5-canvas-drawing-1px-crisp-straight-lines
    private _npxLine(px: number) {
        // With DPR-scaled context, operate in CSS pixels. Keep 0.5 offset for crisp odd line widths.
        const offset = this._ctx.lineWidth % 2 === 0 ? 0 : 0.5
        return px + offset
    }
}
