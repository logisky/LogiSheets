import {injectable} from 'inversify'
import {CellView, RenderCell} from './data'
import {Range} from '@/core/standable'

const RENDER_CELL_COUNT = 1000
const RANGE_COUNT = 2000

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

    releaseCellView(cellView: CellView) {
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

    private _renderCells = Array.from(
        {length: RENDER_CELL_COUNT},
        () => new RenderCell()
    )

    private _ranges = Array.from({length: RANGE_COUNT}, () => new Range())
}
