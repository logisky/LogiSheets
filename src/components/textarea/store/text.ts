import {Text, Texts, History} from '../defs'
import {Box, PainterService, TextAttr} from '@/core/painter'
import {Range} from '@/core/standable'
import type {TextareaStore} from './store'

export interface ITwoDimensionalInfo {
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
}

export class TextManager {
    constructor(public readonly store: TextareaStore) {
        this._texts = Texts.from(this.store.context.text, this.store.context.eof)
    }
    get texts() {
        return this._texts.texts
    }
    init(canvas: HTMLCanvasElement) {
        this._canvas = canvas
    }
    getNewSize(): readonly [width: number, height: number] {
        const texts = this.getTwoDimensionalTexts()
        const baseHeight = this.store.context.lineHeight()
        const height = baseHeight * texts.length
        const widths = texts.map((ts) =>
            ts.map((t) => t.width()).reduce((p, c) => p + c)
        )
        const width = Math.max(...widths, 1)
        return [width, Math.max(height, 1)]
    }

    drawText() {
        const [width, height] = this.getNewSize()
        const paddingRight = 10
        this._painterSvc.setupCanvas(this._canvas, width + paddingRight, height)
        const baseHeight = this.store.context.lineHeight()
        let y = 0
        let x = 0
        this._texts.texts.forEach((text) => {
            const position = new Range()
                .setStartRow(y)
                .setEndRow(y + baseHeight)
                .setStartCol(x)
                .setEndCol(x + text.width() + 2)
            const box = new Box().setPosition(position)
            const attr = new TextAttr()
            attr.setFont(text.font)
            this._painterSvc.text(text.char, attr, box)
            if (text.isEof) {
                y += baseHeight
                x = 0
                this._painterSvc.text(
                    '',
                    new TextAttr(),
                    new Box().setPosition(
                        new Range()
                            .setStartRow(y)
                            .setEndRow(y + baseHeight)
                            .setStartCol(x)
                            .setEndCol(x)
                    ))
            } else {
                x += text.width()
            }
        })
    }

    /**
     * Except eof.
     */
    getTwoDimensionalTexts(): readonly (readonly Text[])[] {
        const texts: Text[][] = []
        let currTexts: Text[] = []
        this._texts.texts.forEach((t) => {
            currTexts.push(t)
            if (t.isEof) {
                texts.push(currTexts)
                currTexts = []
            }
        })
        if (currTexts.length !== 0) texts.push(currTexts)
        return texts
    }

    getPlainText() {
        return this._texts.getPlainText()
    }

    remove(start: number, end: number) {
        const r = this._texts.remove(start, end)
        this.drawText()
        return r
    }
    removeInTwoDimensional(info: ITwoDimensionalInfo) {
        const [start, end] = this._twoDimensionalToOneDimensinal(info)
        return this.remove(start, end)
    }

    replace(
        content: string,
        start: number,
        count: number
    ): readonly [added: readonly Text[], removed: readonly Text[]] {
        const eof = this.store.context.eof
        const newTexts = Texts.from(content, eof)
        const removed = this._texts.replace(newTexts, start, count)
        this._history.add(this._texts)
        this.drawText()
        return [newTexts.texts, removed]
    }

    add(content: string, line?: number, column?: number) {
        const l = line ?? this.store.cursor.lineNumber
        const c = column ?? this.store.cursor.column
        const eof = this.store.context.eof
        const newTexts = Texts.from(content, eof)
        const [start] = this._twoDimensionalToOneDimensinal({
            startLine: l,
            endLine: l,
            startColumn: c,
            endColumn: c
        })
        this._texts.add(newTexts, start)
        this.drawText()
        return newTexts.texts
    }
    private _canvas?: HTMLCanvasElement

    private _texts = new Texts()
    private _history = new History()
    private _painterSvc = new PainterService()
    private _twoDimensionalToOneDimensinal(props: ITwoDimensionalInfo): readonly [start: number, end: number] {
        const {startColumn, startLine, endColumn, endLine} = props
        const texts = this.getTwoDimensionalTexts()
        if (texts.length === 0) return [0, 0]
        let [start, end] = [0, 0]
        for (let i = 0; i <= startLine; i += 1)
            if (i === startLine) start += startColumn
            else start += texts[i].length
        for (let i = 0; i <= endLine; i += 1)
            if (i === endLine) end += endColumn
            else end += texts[i].length
        return [start, end]
    }
}
