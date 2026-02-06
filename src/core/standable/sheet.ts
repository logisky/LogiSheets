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
     * sheet的实际高度
     */
    height = 0
    /**
     * sheet在视图中展示的高度。在滚动时，该视图高度会大于this.sheet
     */
    viewHeight = 0
    /**
     * sheet的实际宽度
     */
    width = 0
    /**
     * sheet在视图中展示的宽度。在滚动时，该视图宽度会大于this.sheet
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
