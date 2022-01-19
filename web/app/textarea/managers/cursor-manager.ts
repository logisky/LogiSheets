import {KeyCodeId} from '@logi-base/src/ts/common/key_code'
import {BaseInfo, BaseInfoBuilder} from '@logi-sheets/web/app/textarea/cursor'
import {Text} from './texts'
import {Context} from './context'
import {TextManager} from './text-manager'
import {BehaviorSubject, Subject, Observable} from 'rxjs'
import {StandardKeyboardEvent} from '@logi-sheets/web/core/events'
import {
    CursorEvent,
    CursorEventBuilder,
} from '@logi-sheets/web/app/textarea/events'

export class CursorManager {
    constructor(
        private readonly _textManager: TextManager,
        private readonly _context: Context,
    ) {
        this._initCursor()
    }
    get cursorEvent$(): Observable<CursorEvent> {
        return this._cursorEvent$
    }

    get lineNumber$(): Observable<number> {
        return this._lineNumber$
    }

    get column$(): Observable<number> {
        return this._column$
    }

    get cursorX$(): Observable<number> {
        return this._cursorX$
    }

    get cursorY$(): Observable<number> {
        return this._cursorY$
    }

    get show$(): Observable<boolean> {
        return this._show$
    }

    get lineNumber(): number {
        return this._lineNumber$.value
    }

    get column(): number {
        return this._column$.value
    }

    get cursorX(): number {
        return this._cursorX$.value
    }

    get cursorY(): number {
        return this._cursorY$.value
    }

    /**
     * 如果offsetX为-1，则cursorX为当前行的最后
     * 如果offsetY为-1，则cursorY为最后一行
     */
    getCursorInfoByPosition(
        offsetX = this._cursorX$.value,
        offsetY = this._cursorY$.value,
    ): BaseInfo {
        const lineNumber = Math.floor(offsetY / this._context.lineHeight())
        const builder = new BaseInfoBuilder()
            .lineNumber(lineNumber)
            .y(lineNumber * this._context.lineHeight())
        const texts = this._textManager.getTwoDimensionalTexts()
        if (texts.length === 0)
            return builder.column(0).x(0).build()
        if (offsetY === -1)
            builder.y((texts.length - 1) * this._context.lineHeight())
        let currLineTexts = texts[lineNumber]
        if (currLineTexts === undefined) {
            const l = texts.length - 1
            builder.lineNumber(l).y(l * this._context.lineHeight())
            currLineTexts = texts[l]
        }
        if (offsetX === -1) {
            let x = 0
            currLineTexts.forEach(t => {
                x += t.width()
            })
            return builder.x(x).column(currLineTexts.length).build()
        }
        let column = 0
        let x = 0
        for (let i = 0; i < currLineTexts.length; i += 1) {
            const t = currLineTexts[i]
            if (t === undefined)
                continue
            if (t.width() + x >= offsetX) {
                const half = t.width() / 2
                if (x + half >= offsetX)
                    column = i
                else {
                    column = i + 1
                    x += t.width()
                }
                break
            }
            x += t.width()
            column = i + 1
        }
        return builder.column(column).x(x).build()
    }

    type(added: readonly Text[], removed: readonly Text[]): void {
        let x = this.cursorX
        let y = this.cursorY
        const [maxWidth] = this._textManager.getNewSize()
        removed.forEach(t => {
            if (t.isEof) {
                y -= this._context.lineHeight()
                x = maxWidth
                return
            }
            x -= t.width()
        })
        added.forEach(t => {
            if (t.isEof) {
                y += this._context.lineHeight()
                x = 0
                return
            }
            x += t.width()
        })
        const cursor = this.getCursorInfoByPosition(x, y)
        this._update(this._show, cursor)
    }

    // tslint:disable-next-line: max-func-body-length
    keydown(e: StandardKeyboardEvent): void {
        const texts = this._textManager.getTwoDimensionalTexts()
        if (e.keyCodeId === KeyCodeId.RIGHTARROW) {
            const next = texts[this.lineNumber][this.column]
            if (next === undefined)
                return
            const cursor = this
                .getCursorInfoByPosition(this.cursorX + next.width())
            if (cursor.x === this.cursorX)
                return
            this._update(this._show, cursor)
        }
        else if (e.keyCodeId === KeyCodeId.LEFTARROW) {
            if (this.column === 0)
                return
            const last = texts[this.lineNumber][this.column - 1]
            const cursor = this
                .getCursorInfoByPosition(this.cursorX - last.width())
            if (cursor.x === this.cursorX)
                return
            this._update(this._show, cursor)
        } else if (e.keyCodeId === KeyCodeId.DOWNARROW) {
            const next = texts[this.lineNumber + 1]
            if (next === undefined)
                return
            const cursor = this.getCursorInfoByPosition(
                this.cursorX,
                this.cursorY + this._context.lineHeight(),
            )
            this._update(this._show, cursor)
        } else if (e.keyCodeId === KeyCodeId.UPARROW) {
            if (this.lineNumber === 0)
                return
            const cursor = this.getCursorInfoByPosition(
                this.cursorX,
                this.cursorY - this._context.lineHeight(),
            )
            this._update(this._show, cursor)
        } else if (e.keyCodeId === KeyCodeId.ENTER)
            this.blur()
        else if (e.keyCodeId === KeyCodeId.ESCAPE)
            this.blur()
    }

    focus(): void {
        this._update(true)
    }

    blur(): void {
        const resetCursor = new BaseInfoBuilder().build()
        this._update(false, resetCursor)
    }

    mousedown(e: MouseEvent): void {
        const [x, y] = this._context.getOffset(e.clientX, e.clientY)
        const cursor = this.getCursorInfoByPosition(x, y)
        this._update(true, cursor)
    }
    private _cursorEvent$ = new Subject<CursorEvent>()
    private _lineNumber$ = new BehaviorSubject<number>(0)
    private _column$ = new BehaviorSubject<number>(0)
    private _cursorX$ = new BehaviorSubject<number>(0)
    private _cursorY$ = new BehaviorSubject<number>(0)
    private _show = false
    private _show$ = new BehaviorSubject<boolean>(this._show)
    private _update(show = this._show, cursor?: BaseInfo): void {
        this._show = show
        const cursorEvent = new CursorEventBuilder().show(show)
        this._show$.next(show)
        if (cursor !== undefined) {
            this._lineNumber$.next(cursor.lineNumber)
            this._cursorX$.next(cursor.x)
            this._cursorY$.next(cursor.y)
            this._column$.next(cursor.column)
            const clientX = cursor.x + this._context.clientX
            const clientY = cursor.y + this._context.clientY
            cursorEvent
                .clientX(clientX)
                .clientY(clientY)
                .columnNumber(cursor.column)
                .lineNumber(cursor.lineNumber)
                .offsetX(cursor.x)
                .offsetY(cursor.y)
        }
        this._cursorEvent$.next(cursorEvent.build())
    }

    private _initCursor(): void {
        const cursor = this.getCursorInfoByPosition(
            this._context.textareaOffsetX,
            this._context.textareaOffsetY
        )
        this._update(false, cursor)
    }
}
