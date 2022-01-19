// tslint:disable: max-params
import {TextsBuilder, Text} from './texts'
import {History} from './history'
import {Context} from './context'
import {
    BoxBuilder,
    PainterService,
    TextAttrBuilder,
} from '@logi-sheets/web/core/painter'
import {Subject, Observable} from 'rxjs'
import {RangeBuilder} from '@logi-sheets/web/core/standable'
export class TextManager {
    constructor(
        public readonly canvas: HTMLCanvasElement,
        public readonly context: Context,
    ) {
        this._texts = TextsBuilder.from(this.context.text, this.context.eof)
        this._history.init()
        this._painterSvc.setupCanvas(this.canvas)
        this.drawText()
    }
    get textChanged$(): Observable<undefined> {
        return this._textChanged$
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

    drawText() {
        const [width, height] = this.getNewSize()
        const paddingRight = 10
        this._painterSvc.setupCanvas(this.canvas, width + paddingRight, height)
        const texts = this.getTwoDimensionalTexts()
        const baseHeight = this.context.lineHeight()
        texts.forEach((ts, i) => {
            const y = i * baseHeight
            let x = 0
            ts.forEach(t => {
                const position = new RangeBuilder()
                    .startRow(y)
                    .endRow(y + this.context.lineHeight())
                    .startCol(x)
                    .endCol(x + t.width() + 2)
                    .build()
                const box = new BoxBuilder().position(position).build()
                const attr = new TextAttrBuilder().font(t.font).build()
                this._painterSvc.text(t.char, attr, box)
                x += t.width()
            })
        })
        this._textChanged$.next()
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
        return texts.getPlainText()
    }

    redo() {
        let texts = this._history.redo()
        if (texts === undefined)
            texts = this._texts
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
        return this._texts.remove(start, end)
    }

    replace(
        content: string,
        start: number,
        end?: number,
    ): readonly [added: readonly Text[], removed: readonly Text[]] {
        const e = end ?? this._texts.texts.length
        const eof = this.context.eof
        const newTexts = TextsBuilder.from(content, eof)
        const removed = this._texts.replace(newTexts, start, e)
        this._history.add(this._texts)
        return [newTexts.texts, removed]
    }

    add(content: string, line: number, column: number) {
        const eof = this.context.eof
        const newTexts = TextsBuilder.from(content, eof)
        const [start] = this
            ._twoDimensionalToOneDimensinal(line, column, line, column)
        this._texts.add(newTexts, start)
        return newTexts.texts
    }

    replaceByTwoDimenSional(
        content: string,
        startLine: number,
        startColumn: number,
        endLine: number,
        endColumn: number,
    ) {
        const [start, end] = this._twoDimensionalToOneDimensinal(
            startLine,
            startColumn,
            endLine,
            endColumn,
        )
        const [added, removed] = this.replace(content, start, end)
        return {added, removed}
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
    private _textChanged$ = new Subject<undefined>()
    private _texts = new TextsBuilder().build()
    private _history = new History()
    private _painterSvc = new PainterService()
    private _twoDimensionalToOneDimensinal(
        startLine: number,
        startColumn: number,
        endLine: number,
        endColumn: number,
    ): readonly [start: number, end: number] {
        const texts = this.getTwoDimensionalTexts()
        if (texts.length === 0)
            return [0,0]
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
