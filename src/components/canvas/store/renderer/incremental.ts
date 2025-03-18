import {Rect} from './types'

export interface DrawContent {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    getRect(): Rect
}

export interface Canvas {
    readonly x: number
    readonly y: number
    setSize(width: number, height: number): void
    moveImage(
        sx: number,
        sy: number,
        width: number,
        height: number,
        dx: number,
        dy: number
    ): void
    clearRect(rect: Rect): void
    setSize(width: number, height: number): void
    getSize(): {width: number; height: number}
    clear(): void
    getRect(): Rect
    getElement(): HTMLCanvasElement
}

/**
 * This class is designed to deal with the smooth scrolling issue.
 */
export class IncrementalRenderer<T extends DrawContent, C extends Canvas> {
    constructor(
        private canvas: C,
        private fetchData: (rect: Rect) => Promise<T>,
        private render: (
            canvas: C,
            data: T,
            anchorX: number,
            anchorY: number
        ) => void,
        private horizontalBuffer: number,
        private verticalBuffer: number,
        private xUnit: number,
        private yUnit: number
    ) {}

    public getCanvas(): HTMLCanvasElement {
        return this.canvas.getElement()
    }

    public hasCovered(rect: Rect): boolean {
        const targetUnits = CutRectIntoUnits(rect, this.xUnit, this.yUnit)
        const currentUnits = this._currentData.map((t) => t.getRect())
        const {current, target: _} = findCommonRects(currentUnits, targetUnits)
        return current.length > 0
    }

    public clear(): void {
        this.canvas.clear()
        this._currentData = []
    }

    public drawTo(ctx: CanvasRenderingContext2D, want: Rect, to: Rect): void {
        ctx.drawImage(
            this.getCanvas(),
            -this._currentAnchorX + want.x,
            -this._currentAnchorY + want.y,
            want.width,
            want.height,
            to.x,
            to.y,
            want.width,
            want.height
        )
    }

    public async fullyRender(rect: Rect): Promise<void> {
        const width = rect.width + this.horizontalBuffer * 2
        const height = rect.height + this.verticalBuffer * 2
        if (this.canvas.getSize().width < width) {
            this.canvas.setSize(width, this.canvas.getSize().height)
        }
        if (this.canvas.getSize().height < height) {
            this.canvas.setSize(this.canvas.getSize().width, height)
        }
        const targetRect = {
            x: rect.x - this.horizontalBuffer,
            y: rect.y - this.verticalBuffer,
            width: width,
            height: height,
        }

        const targetUnits = CutRectIntoUnits(targetRect, this.xUnit, this.yUnit)

        const currentUnits = this._currentData.map((t) => t.getRect())
        const {current, target} = findCommonRects(currentUnits, targetUnits)

        const newData: T[] = []
        let included = false
        for (let i = 0; i < currentUnits.length; i++) {
            if (current.includes(i)) {
                // this.canvas.moveImage(
                //     currentUnits[i].x - this._previousAnchorX,
                //     currentUnits[i].y - this._previousAnchorY,
                //     currentUnits[i].width,
                //     currentUnits[i].height,
                //     currentUnits[i].x - this.getAnchorX(),
                //     currentUnits[i].y - this.getAnchorY()
                // )
                included = true
                newData.push(this._currentData[i])
            } else {
                this.canvas.clearRect(currentUnits[i])
            }
        }

        let anchorX = this._currentAnchorX
        let anchorY = this._currentAnchorY
        let minX = targetUnits[0].x
        let minY = targetUnits[0].y
        const fetchingPromises: Promise<T>[] = []
        for (let j = 0; j < targetUnits.length; j++) {
            if (!target.includes(j)) {
                const promiseData = this.fetchData(targetUnits[j])
                fetchingPromises.push(promiseData)
                if (targetUnits[j].x < minX) {
                    minX = targetUnits[j].x
                }
                if (targetUnits[j].y < minY) {
                    minY = targetUnits[j].y
                }
            }
        }
        if (!included) {
            anchorX = minX
            anchorY = minY
        }
        const fetchingResults = await Promise.all(fetchingPromises)
        for (let j = 0; j < fetchingResults.length; j++) {
            newData.push(fetchingResults[j])
            this.render(this.canvas, fetchingResults[j], anchorX, anchorY)
        }

        this._currentData = newData
        this._currentAnchorX = anchorX
        this._currentAnchorY = anchorY
    }

    public getCurrentData(): T[] {
        return this._currentData
    }

    private _currentData: T[] = []
    private _currentAnchorX: number = 0
    private _currentAnchorY: number = 0
}

/**
 * A helper class to build an IncrementalRenderer.
 */
export class IncrementalRendererBuilder<
    T extends DrawContent,
    C extends Canvas
> {
    public setCanvas(canvas: C): this {
        this.canvas = canvas
        return this
    }

    public setFetchData(fetchData: (rect: Rect) => Promise<T>): this {
        this.fetchData = fetchData
        return this
    }

    public setRender(
        render: (canvas: C, data: T, anchorX: number, anchorY: number) => void
    ): this {
        this.render = render
        return this
    }

    public setHorizontalBuffer(horizontalBuffer: number): this {
        this.horizontalBuffer = horizontalBuffer
        return this
    }

    public setVerticalBuffer(verticalBuffer: number): this {
        this.verticalBuffer = verticalBuffer
        return this
    }

    // public setXUnit(xUnit: number): this {
    //     this.xUnit = xUnit
    //     return this
    // }

    // public setYUnit(yUnit: number): this {
    //     this.yUnit = yUnit
    //     return this
    // }

    private canvas?: C
    private fetchData?: (rect: Rect) => Promise<T>
    private render?: (
        canvas: C,
        data: T,
        anchorX: number,
        anchorY: number
    ) => void
    private horizontalBuffer?: number
    private verticalBuffer?: number
    private xUnit: number = 100
    private yUnit: number = 300

    public build(): IncrementalRenderer<T, C> {
        if (!this.canvas || !this.fetchData || !this.render) {
            throw new Error('Canvas, fetchData, and render must be set')
        }
        if (!this.horizontalBuffer || !this.verticalBuffer) {
            throw new Error('Horizontal and vertical buffers must be set')
        }

        return new IncrementalRenderer(
            this.canvas,
            this.fetchData,
            this.render,
            this.horizontalBuffer,
            this.verticalBuffer,
            this.xUnit,
            this.yUnit
        )
    }
}

export function CutRectIntoUnits(
    rect: Rect,
    xUnit: number,
    yUnit: number
): Rect[] {
    const x = Math.max(rect.x, 0)
    const y = Math.max(rect.y, 0)
    const units: Rect[] = []
    const xStart = Math.floor(x / xUnit)
    const yStart = Math.floor(y / yUnit)
    const xEnd = Math.floor((x + rect.width) / xUnit)
    const yEnd = Math.floor((y + rect.height) / yUnit)
    for (let x = xStart; x <= xEnd; x++) {
        for (let y = yStart; y <= yEnd; y++) {
            units.push({
                x: x * xUnit,
                y: y * yUnit,
                width: xUnit,
                height: yUnit,
            })
        }
    }
    return units
}

export function findCommonRects(
    current: Rect[],
    target: Rect[]
): {current: number[]; target: number[]} {
    let i = 0
    let j = 0
    const currentIndex: number[] = []
    const targetIndex: number[] = []
    while (i < current.length && j < target.length) {
        if (current[i].x === target[j].x && current[i].y === target[j].y) {
            currentIndex.push(i)
            targetIndex.push(j)
            i++
            j++
        } else if (current[i].x < target[j].x) {
            i++
        } else {
            j++
        }
    }
    return {current: currentIndex, target: targetIndex}
}
