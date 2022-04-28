import {Comment} from 'bindings'
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
export class StandardSheet {
    name = ''
    frozen?: Frozen
    merges: readonly Range[] = []
    getComment(row: number, col: number) {
        const key = `${row}:${col}`
        return this._comments.get(key)
    }

    setComments(comments: readonly Comment[]) {
        this._comments.clear()
        comments.forEach(c => {
            this._comments.set(`${c.row}:${c.col}`, c)
        })
    }
    private _comments = new Map<string, Comment>()
}
