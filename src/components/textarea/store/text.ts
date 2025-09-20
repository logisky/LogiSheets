import {Text, Texts, History} from '../defs'
import {Box, PainterService, TextAttr} from '@/core/painter'
import {Range, StandardColor, StandardFont} from '@/core/standable'
import type {TextareaStore} from './store'
import {EOF, getHighlightColor} from '@/components/const'
import {CellRef, FormulaDisplayInfo, TokenType} from 'logisheets-web'
import {shallowCopy} from '@/core'

export interface ITwoDimensionalInfo {
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
}

export class TextManager {
    constructor(public readonly store: TextareaStore) {
        this._texts = Texts.from(this.store.context.text, EOF)
    }
    get texts() {
        return this._texts.texts
    }
    init(
        canvas: HTMLCanvasElement,
        typeFunc: (text: string) => Promise<FormulaDisplayInfo | undefined>
    ) {
        this._canvas = canvas
        this._typeFunc = typeFunc
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

    drawText(info: FormulaDisplayInfo) {
        const [width, height] = this.getNewSize()
        const paddingRight = 10
        this._painterSvc.setupCanvas(this._canvas, width + paddingRight, height)
        this._x = 0
        this._y = 0
        const s = this.getPlainText()
        const units = convertToDisplayUnits(s, info)
        let idx = 0
        let colorIdx = 0
        units.forEach((unit) => {
            if (unit.ty === 'funcArg') {
                return
            }
            if (unit.ty === 'cellReference') {
                colorIdx = this._paintCellRef(
                    unit,
                    info.cellRefs[idx],
                    colorIdx
                )
                idx += 1
            } else if (unit.ty === 'funcName') {
                this._paintFuncName(unit)
            } else if (unit.ty === 'wrongSuffix') {
                this._paintWrongSuffix(unit)
            } else {
                this._paintPlainText(unit)
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
        this.paintText()
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
        const newTexts = Texts.from(content, EOF)
        const removed = this._texts.replace(newTexts, start, count)
        this._history.add(this._texts)
        this.paintText()
        return [newTexts.texts, removed]
    }

    add(content: string, line?: number, column?: number) {
        const l = line ?? this.store.cursor.lineNumber
        const c = column ?? this.store.cursor.column
        const newTexts = Texts.from(content, EOF)
        const [start] = this._twoDimensionalToOneDimensinal({
            startLine: l,
            endLine: l,
            startColumn: c,
            endColumn: c,
        })
        this._texts.add(newTexts, start)
        this.paintText()
        return newTexts.texts
    }

    paintText() {
        const text = this.getPlainText()
        this._typeFunc!(text).then((displayInfo) => {
            if (!displayInfo) {
                this.drawText({
                    cellRefs: [],
                    tokenUnits: [],
                })
                return
            }
            this.drawText(displayInfo)
        })
    }

    private _paintPlainText(unit: DisplayUnit) {
        if (unit.ty === 'eof') {
            this._y += this.store.context.lineHeight()
            this._x = 0
            return
        }
        const width = this._measureText(unit.content)
        const position = new Range()
            .setStartRow(this._y)
            .setEndRow(this._y + this.store.context.lineHeight())
            .setStartCol(this._x)
            .setEndCol(this._x + width)
        const box = new Box().setPosition(position)
        const attr = new TextAttr()
        attr.setFont(TextManager.font)
        this._painterSvc.text(unit.content, attr, box)
        this._x += width
    }

    private _paintWrongSuffix(unit: DisplayUnit) {
        const width = this._measureText(unit.content)
        const position = new Range()
            .setStartRow(this._y)
            .setEndRow(this._y + this.store.context.lineHeight())
            .setStartCol(this._x)
            .setEndCol(this._x + width)
        const box = new Box().setPosition(position)
        const attr = new TextAttr()
        const font = new StandardFont().setSize(TextManager.font.size)
        font.standardColor = StandardColor.fromArgb('CCFF6B6B')
        attr.setFont(font)
        this._painterSvc.text(unit.content, attr, box)
        this._x += width
    }

    private _paintFuncName(unit: DisplayUnit) {
        const font = new StandardFont().setSize(TextManager.font.size)
        font.bold = true
        const width = this._measureText(unit.content, font)
        const position = new Range()
            .setStartRow(this._y)
            .setEndRow(this._y + this.store.context.lineHeight())
            .setStartCol(this._x)
            .setEndCol(this._x + width)
        const box = new Box().setPosition(position)
        const attr = new TextAttr()
        attr.setFont(font)
        this._painterSvc.text(unit.content, attr, box)
        this._x += width
    }

    private _measureText(content: string, font?: StandardFont): number {
        const f = font ?? TextManager.font
        let width = 0
        content.split('').forEach((c) => {
            width += Text.measureText(c, f.toCssFont()).width
        })
        return width
    }

    private _paintCellRef(
        unit: DisplayUnit,
        cellRef: CellRef,
        idx: number
    ): number {
        if (unit.ty !== 'cellReference') {
            throw Error('Expect cellReference but got: ' + unit.ty)
        }
        if (cellRef.workbook !== undefined) {
            this._paintPlainText(unit)
            return idx
        }

        if (cellRef.sheet1 !== undefined && cellRef.sheet2 !== undefined) {
            this._paintPlainText(unit)
            return idx
        }

        if (
            cellRef.sheet1 !== undefined &&
            cellRef.sheet1 !== this.store.context.sheetName
        ) {
            this._paintPlainText(unit)
            return idx
        }

        const color = getHighlightColor(idx)
        color.setAlpha(180)
        const width = this._measureText(unit.content)
        const box = new Box().setPosition(
            new Range()
                .setStartRow(this._y - 2)
                .setEndRow(this._y + this.store.context.lineHeight() + 2)
                .setStartCol(this._x - 2)
                .setEndCol(this._x + width + 2)
        )
        this._painterSvc.fillRoundedBg(color.css(), box, 5)
        const textPosition = new Range()
            .setStartRow(this._y)
            .setEndRow(this._y + this.store.context.lineHeight())
            .setStartCol(this._x)
            .setEndCol(this._x + width)
        const textBox = new Box().setPosition(textPosition)
        const attr = new TextAttr()
        attr.setFont(TextManager.font)
        this._painterSvc.text(unit.content, attr, textBox)
        this._x += width
        return idx + 1
    }

    private _canvas?: HTMLCanvasElement

    private _x: number = 0
    private _y: number = 0

    private _texts = new Texts()
    private _history = new History()
    private _painterSvc = new PainterService()
    private _typeFunc?: (
        text: string
    ) => Promise<FormulaDisplayInfo | undefined>
    private _twoDimensionalToOneDimensinal(
        props: ITwoDimensionalInfo
    ): readonly [start: number, end: number] {
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

    public static font: StandardFont = new StandardFont().setSize(14)
}

interface DisplayUnit {
    content: string
    ty: TokenType | 'eof'
}

function convertToDisplayUnits(
    s: string,
    displayInfo: FormulaDisplayInfo
): readonly DisplayUnit[] {
    const offset = 1
    let stringIdx = 0
    const units: DisplayUnit[] = []

    for (let i = 0; i < displayInfo.tokenUnits.length; i++) {
        const start = displayInfo.tokenUnits[i].start + offset
        const end = displayInfo.tokenUnits[i].end + offset
        if (start > stringIdx) {
            const unit: DisplayUnit = {
                content: s.slice(stringIdx, start),
                ty: 'other',
            }
            units.push(unit)
        }

        const unit: DisplayUnit = {
            content: s.slice(start, end),
            ty: displayInfo.tokenUnits[i].tokenType,
        }
        units.push(unit)
        stringIdx = end
    }

    if (stringIdx < s.length) {
        units.push({
            content: s.slice(stringIdx, s.length),
            ty: 'other',
        })
    }

    const splitUnitAtEof = (unit: DisplayUnit): readonly DisplayUnit[] => {
        const units: DisplayUnit[] = []
        const idx = unit.content.indexOf(EOF)
        if (idx === -1) {
            units.push(unit)
            return units
        }
        units.push({
            content: unit.content.slice(0, idx),
            ty: unit.ty,
        })
        units.push({
            content: '',
            ty: 'eof',
        })
        units.push({
            content: unit.content.slice(idx + 1),
            ty: unit.ty,
        })
        return units
    }

    const newUnits: DisplayUnit[] = []
    units.forEach((unit) => {
        if (unit.ty === 'eof') {
            newUnits.push(unit)
            return
        }
        newUnits.push(...splitUnitAtEof(unit))
    })

    return newUnits
}
