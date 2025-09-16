import {action, computed, makeObservable, observable} from 'mobx'
import {Text} from '../defs'
import {BaseInfo} from '../cursor'
import type {TextareaStore} from './store'
import {Subject} from 'rxjs'

export class Cursor {
    constructor(public readonly store: TextareaStore) {
        makeObservable(this)
    }
    cursor$ = new Subject()

    compositionStart = -1

    @computed
    get cursorPosition() {
        return this._getCursorInOneLine()
    }

    @observable
    /**
     * update it by this.updatePostion
     */
    showCursor = false

    @observable
    /**
     * update it by this.updatePostion
     */
    x = 0

    @observable
    /**
     * update it by this.updatePostion
     */
    y = 0

    @observable
    /**
     * update it by this.updatePostion
     */
    lineNumber = 0

    @observable
    /**
     * update it by this.updatePostion
     */
    column = 0
    toBaseInfo() {
        return new BaseInfo()
            .setColumn(this.column)
            .setLineNumber(this.lineNumber)
            .setX(this.x)
            .setY(this.y)
    }

    @action
    focus() {
        const textLength = this.store.textManager.texts.length
        this.updatePosition(textLength)
        this.showCursor = true
    }

    @action
    blur() {
        this.showCursor = false
    }

    @action
    type(added: readonly Text[], removed: readonly Text[]) {
        let currPosition = this.cursorPosition
        if (this.store.selection?.selection) {
            const {startColumn, startLine, startX, startY} =
                this.store.selection.selection
            this._updateByCursorInfo(
                new BaseInfo()
                    .setColumn(startColumn)
                    .setLineNumber(startLine)
                    .setX(startX)
                    .setY(startY)
            )
            return
        } else currPosition -= removed.length
        currPosition += added.length
        this.updatePosition(currPosition)
    }

    @action
    mousedown(e: MouseEvent) {
        const [x, y] = this.store.context.getOffset(e.clientX, e.clientY)
        const cursor = this.getCursorInfoByPosition(x, y)
        this._updateByCursorInfo(cursor)
    }

    @action
    updatePosition(cursorPosition: number) {
        const info = this.getCursorInfoByOneLineCoordinate(cursorPosition)
        this._updateByCursorInfo(info)
    }

    @action
    updateTwoDimensionalPosition(line: number, column: number) {
        const baseInfo = new BaseInfo()

        const texts = this.store.textManager.getTwoDimensionalTexts()
        baseInfo.setLineNumber(Math.min(line, texts.length - 1))

        for (let i = 0; i < texts.length; i++) {
            const t = texts[i]
            if (i !== line) {
                continue
            }
            baseInfo.setColumn(Math.min(t.length, column))
            baseInfo.setX(
                t
                    .slice(0, baseInfo.column)
                    .reduce((pre, cur) => pre + cur.width(), 0)
            )
        }
        baseInfo.setY(baseInfo.lineNumber * this.store.context.lineHeight())

        this._updateByCursorInfo(baseInfo)
    }

    /**
     * @param offsetX -1 represent the last column of current line
     * @param offsetY -1 represent the last line
     */
    getCursorInfoByPosition(offsetX: number, offsetY: number) {
        const baseHeight = this.store.context.lineHeight()
        const lineNumber = Math.floor(offsetY / baseHeight)
        const baseInfo = new BaseInfo()
            .setLineNumber(lineNumber)
            .setY(lineNumber * baseHeight)
        const texts = this.store.textManager.getTwoDimensionalTexts()
        if (texts.length === 0) return baseInfo
        if (offsetY === -1) baseInfo.setY((texts.length - 1) * baseHeight)
        let currLineTexts = texts[lineNumber]
        if (currLineTexts === undefined) {
            const l = texts.length - 1
            baseInfo.setLineNumber(l).setY(l * baseHeight)
            currLineTexts = texts[l]
        }
        if (offsetX === -1) {
            let x = 0
            currLineTexts.forEach((t) => {
                x += t.width()
            })
            baseInfo.setX(x).setColumn(currLineTexts.length)
            return baseInfo
        }
        let column = 0
        let x = 0
        for (let i = 0; i < currLineTexts.length; i += 1) {
            const t = currLineTexts[i]
            if (t === undefined) continue
            if (t.width() + x >= offsetX) {
                const half = t.width() / 2
                if (x + half >= offsetX) column = i
                else {
                    column = i + 1
                    x += t.width()
                }
                break
            }
            x += t.width()
            column = i + 1
        }
        return baseInfo.setColumn(column).setX(x)
    }

    @action
    private _updateByCursorInfo(info: BaseInfo) {
        this.x = info.x
        this.y = info.y
        this.lineNumber = info.lineNumber
        this.column = info.column
        this.cursor$.next(undefined)
    }

    private _getCursorInfoByCoordinate(line: number, column: number) {
        const texts = this.store.textManager.getTwoDimensionalTexts()
        const baseInfo = new BaseInfo()
            .setColumn(column)
            .setLineNumber(line)
            .setY(line * this.store.context.lineHeight())
        let x = 0
        for (let i = 0; i < texts[line].length && i < column; i++) {
            x += texts[line][i].width()
        }
        baseInfo.x = x
        return baseInfo
    }

    private _getCursorInOneLine() {
        let result = 0
        let line = 0
        const texts = this.store.textManager.texts
        for (let i = 0; i < texts.length; i++) {
            const t = texts[i]
            if (this.lineNumber === line) {
                result += this.column
                break
            } else {
                result += 1
                line += t.isEof ? 1 : 0
            }
        }
        return result
    }
    private getCursorInfoByOneLineCoordinate(cursor: number): BaseInfo {
        const baseInfo = new BaseInfo()
        const texts = this.store.textManager.texts
        for (let i = 0; i < texts.length; i++) {
            if (i === cursor) break
            const t = texts[i]
            if (t.isEof) {
                baseInfo
                    .setY(baseInfo.y + this.store.context.lineHeight())
                    .setX(0)
                    .setLineNumber(baseInfo.lineNumber + 1)
                    .setColumn(0)
            } else {
                baseInfo
                    .setX(baseInfo.x + t.width())
                    .setColumn(baseInfo.column + 1)
            }
        }
        return baseInfo
    }
}
