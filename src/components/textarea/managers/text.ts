import { Text, Texts, History, Context } from '../defs'
import { Box, PainterService, TextAttr } from 'core/painter'
import { Range } from 'core/standable'
import { BehaviorSubject, Observable } from 'rxjs'
export class TextManager<T> {
    constructor(
        public readonly context: Context<T>,
    ) {
        this._texts = Texts.from(this.context.text, this.context.eof)
        this._textChange$.next(this.getPlainText())
    }
    textChanged(): Observable<string> {
        return this._textChange$
    }
    getNewSize(): readonly [width: number, height: number] {
        const texts = this.getTwoDimensionalTexts()
        const baseHeight = this.context.lineHeight()
        const height = baseHeight * texts.length
        const widths = texts.map(ts => ts.map(t => t.width()).reduce((
            p,
            c
        ) => p + c))
        const width = Math.max(...widths)
        return [width, height]
    }

    drawText(canvas?: HTMLCanvasElement) {
        const [width, height] = this.getNewSize()
        const paddingRight = 10
        this._painterSvc.setupCanvas(canvas, width + paddingRight, height)
        const texts = this.getTwoDimensionalTexts()
        const baseHeight = this.context.lineHeight()
        texts.forEach((ts, i) => {
            const y = i * baseHeight
            let x = 0
            ts.forEach(t => {
                const position = new Range()
                    .setStartRow(y)
                    .setEndRow(y + this.context.lineHeight())
                    .setStartCol(x)
                    .setEndCol(x + t.width() + 2)
                const box = new Box()
                box.position = position
                const attr = new TextAttr()
                attr.setFont(t.font)
                this._painterSvc.text(t.char, attr, box)
                x += t.width()
            })
        })
        this._textChange$.next(this.getPlainText())
    }

    /**
     * Except eof.
     */
    getTwoDimensionalTexts(): readonly (readonly Text[])[] {
        const texts: Text[][] = []
        let currTexts: Text[] = []
        this._texts.texts.forEach(t => {
            currTexts.push(t)
            if (t.isEof) {
                texts.push(currTexts)
                currTexts = []
            }
        })
        if (currTexts.length !== 0)
            texts.push(currTexts)
        return texts
    }

    getPlainText() {
        return this._texts.getPlainText()
    }

    undo() {
        let texts = this._history.undo()
        if (texts === undefined)
            texts = this._texts
        this.drawText()
        return texts.getPlainText()
    }

    redo() {
        let texts = this._history.redo()
        if (texts === undefined)
            texts = this._texts
        this.drawText()
        return texts.getPlainText()
    }

    remove(
        startLine: number,
        startColumn: number,
        endLine: number,
        endColumn: number,
    ) {
        const [start, end] = this._twoDimensionalToOneDimensinal(
            startLine,
            startColumn,
            endLine,
            endColumn
        )
        const r = this._texts.remove(start, end)
        this.drawText()
        return r
    }

    replace(
        content: string,
        start: number,
        count: number,
    ): readonly [added: readonly Text[], removed: readonly Text[]] {
        const eof = this.context.eof
        const newTexts = Texts.from(content, eof)
        const removed = this._texts.replace(newTexts, start, count)
        this._history.add(this._texts)
        this.drawText()
        return [newTexts.texts, removed]
    }

    add(content: string, line: number, column: number) {
        const eof = this.context.eof
        const newTexts = Texts.from(content, eof)
        const [start] = this
            ._twoDimensionalToOneDimensinal(line, column, line, column)
        this._texts.add(newTexts, start)
        this.drawText()
        return newTexts.texts
    }

    getText(
        startLine: number,
        startColumn: number,
        endLine: number,
        endColumn: number
    ): readonly Text[] {
        const [start, end] = this._twoDimensionalToOneDimensinal(
            startLine,
            startColumn,
            endLine,
            endColumn,
        )
        return this._texts.texts.slice(start, end)
    }
    // private _textChanged$ = new Subject<undefined>()
    private _texts = new Texts()
    private _history = new History()
    private _painterSvc = new PainterService()
    private _textChange$ = new BehaviorSubject('')
    private _twoDimensionalToOneDimensinal(
        startLine: number,
        startColumn: number,
        endLine: number,
        endColumn: number,
    ): readonly [start: number, end: number] {
        const texts = this.getTwoDimensionalTexts()
        if (texts.length === 0)
            return [0, 0]
        let [start, end] = [0, 0]
        for (let i = 0; i <= startLine; i += 1)
            if (i === startLine)
                start += startColumn
            else
                start += texts[i].length
        for (let i = 0; i <= endLine; i += 1)
            if (i === endLine)
                end += endColumn
            else
                end += texts[i].length
        return [start, end]
    }
}
