import {injectable} from 'inversify'
import {CellView} from './worker/types'
import {RenderCell} from './worker/render'
import {Range, StandardCell} from '@/core/standable'
import {StandardValue} from './standable/value'
import {StandardStyle} from './standable/style'

const RENDER_CELL_COUNT = 5000
const RANGE_COUNT = 6000
const CACHE_NUMBER = 2

/**
 * This is an object pool used to manage the creation and reuse of frequently used objects,
 * such as `RenderCell` and `Range`.
 *
 * **Why use an Object Pool?**
 *
 * Object pools are particularly useful in scenarios where objects are expensive to create
 * or when an application repeatedly creates and destroys similar objects. Reusing existing
 * objects from the pool instead of constantly allocating new memory can significantly
 * reduce the overhead and improve performance.
 *
 * In this case, reusing `RenderCell` and `Range` instances avoids the cost of frequent
 * object creation, thereby making the rendering process smoother and more efficient.
 * By maintaining a pool of reusable objects, the system can handle frequent rendering
 * tasks without triggering excessive memory allocation or garbage collection,
 * ensuring a faster and more responsive user experience.
 *
 * This pattern is particularly beneficial for applications involving large datasets,
 * complex rendering tasks, or real-time updates where performance is critical.
 */

@injectable()
export class Pool {
    getRenderCell(): RenderCell {
        if (this._renderCells.length > 0) {
            return this._renderCells.pop() as RenderCell
        }

        return new RenderCell()
    }

    releaseRenderCell(c: RenderCell) {
        c.reset()
        this.releaseRange(c.position)
        this.releaseRange(c.coordinate)
        if (c.info) {
            this.releaseStandardCell(c.info)
        }
        this._renderCells.push(c)
    }

    getRange(): Range {
        if (this._ranges.length > 0) return this._ranges.pop() as Range
        return new Range()
    }

    releaseRange(r: Range) {
        r.reset()
        this._ranges.push(r)
    }

    getStandardValue(): StandardValue {
        if (this._standardValues.length > 0)
            return this._standardValues.pop() as StandardValue
        return new StandardValue()
    }

    releaseStandardValue(v: StandardValue) {
        v.cellValueOneof = undefined
        this._standardValues.push(v)
    }

    getStandardStyle(): StandardStyle {
        if (this._standardStyles.length > 0) {
            return this._standardStyles.pop() as StandardStyle
        }
        return new StandardStyle()
    }

    releaseStandardStyle(s: StandardStyle) {
        this._standardStyles.push(s)
    }

    getStandardCell(): StandardCell {
        if (this._standardCells.length > 0)
            return this._standardCells.pop() as StandardCell
        return new StandardCell()
    }

    releaseStandardCell(c: StandardCell) {
        if (c.value) this.releaseStandardValue(c.value)
        if (c.style) this.releaseStandardStyle(c.style)
        this._standardCells.push(c)
    }

    releaseCellView(v: CellView) {
        /**
         * We don't really release the render cells at once since
         * these render cells are still used in other places.
         */
        if (this._cellViews.length >= CACHE_NUMBER) {
            const cellView = this._cellViews.pop() as CellView
            cellView.rows.forEach((c) => {
                this.releaseRenderCell(c)
            })
            cellView.cols.forEach((c) => {
                this.releaseRenderCell(c)
            })
            cellView.cells.forEach((c) => {
                this.releaseRenderCell(c)
            })
        }
        this._cellViews.push(v)
    }

    private _renderCells = Array.from(
        {length: RENDER_CELL_COUNT},
        () => new RenderCell()
    )

    private _ranges = Array.from({length: RANGE_COUNT}, () => new Range())
    private _standardCells = Array.from(
        {length: RENDER_CELL_COUNT},
        () => new StandardCell()
    )
    private _standardValues = Array.from(
        {length: RENDER_CELL_COUNT},
        () => new StandardValue()
    )
    private _standardStyles = Array.from(
        {length: RENDER_CELL_COUNT},
        () => new StandardStyle()
    )

    private _cellViews: CellView[] = []
}
