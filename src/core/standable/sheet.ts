import {Comment} from 'logisheets-engine'
import {Range} from './range'

export interface TopLeftCell {
    readonly row: number
    readonly col: number
}
export interface Frozen {
    readonly topLeftCell: TopLeftCell
    readonly rowCount: number
    readonly columnCount: number
}
export interface Scroll {
    readonly x: number
    readonly y: number
    update(type: 'x' | 'y', value: number): void
}
export class ScrollImpl implements Scroll {
    x = 0
    y = 0
    update(type: 'x' | 'y', value: number) {
        if (type === 'x') this.x = value
        else this.y = value
    }
}
export class StandardSheet {
    /**
     * The sheet's actual height.
     */
    height = 0
    /**
     * The height the sheet is shown with in the view. While scrolling this is
     * larger than the actual height.
     */
    viewHeight = 0
    /**
     * The sheet's actual width.
     */
    width = 0
    /**
     * The width the sheet is shown with in the view. While scrolling this is
     * larger than the actual width.
     */
    viewWidth = 0
    name = ''
    frozen?: Frozen
    merges: readonly Range[] = []
    scroll: Scroll = new ScrollImpl()
    getComment(row: number, col: number) {
        const key = `${row}:${col}`
        return this._comments.get(key)
    }

    setComments(comments: readonly Comment[]) {
        this._comments.clear()
        comments.forEach((c) => {
            this._comments.set(`${c.row}:${c.col}`, c)
        })
    }
    maxHeight() {
        return Math.max(this.viewHeight, this.height)
    }
    maxWidth() {
        return Math.max(this.viewWidth, this.width)
    }
    private _comments = new Map<string, Comment>()
}
