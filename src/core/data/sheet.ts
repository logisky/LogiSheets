// tslint:disable: max-params
import {
    RowInfo,
    ColInfo,
    Style,
    MergeCell,
    Comment,
    Value,
    BlockInfo,
} from 'proto/message'
import {
    StandardBlock,
    StandardRowInfo,
    StandardColInfo,
    StandardCell,
    StandardSheet,
    Range,
} from 'core/standable'

import { SETTINGS } from 'common/settings'
import { StandardValue } from 'core/standable/value'
export const MAX_COUNT = 100000000

export class SheetService {
    constructor() {
        const sheet = new StandardSheet()
        sheet.name = SETTINGS.defaultSheetName
        this._sheet.set(0, sheet)
    }
    setBlocks (sheet: number, blocks: readonly BlockInfo[]) {
        const bls = blocks.map(b => StandardBlock.from(b))
        this._blocks.set(sheet, bls)
    }

    getBlocks (sheet = this._activeIndex) {
        return this._blocks.get(sheet) ?? []
    }

    clear () {
        this._cells.clear()
        this._colInfos.clear()
        this._rowInfos.clear()
        this._blocks.clear()
    }

    setCell (
        row: number,
        col: number,
        sheet: number,
        cell: {
            readonly style?: Style,
            readonly value?: Value,
            readonly formula?: string
        }
    ) {
        const key = genKey(sheet, row, col)
        let c = this._cells.get(key)
        if (!c)
            c = new StandardCell()
        if (cell.style)
            c.setStyle(cell.style)
        if (cell.value)
            c.value = StandardValue.from(cell.value)
        if (cell.formula !== undefined)
            c.formula = cell.formula
        this._cells.set(key, c)
    }

    getSheet (sheet = this._activeIndex) {
        return this._sheet.get(sheet)
    }

    getSheets (): readonly StandardSheet[] {
        // tslint:disable-next-line: prefer-literal prefer-array-literal
        const sheets = new Array(this._sheet.size)
        this._sheet.forEach((sheet, index) => {
            sheets[index] = sheet
        })
        return sheets
    }

    setSheet (
        sheet: number,
        info: {
            readonly merges?: readonly MergeCell[],
            readonly name?: string,
            readonly comments?: readonly Comment[],
        }
    ) {
        let s = this._sheet.get(sheet)
        if (!s)
            s = new StandardSheet()
        if (info.merges !== undefined) {
            const ms = info.merges.map(m => Range.fromMergeCell(m))
            s.merges = ms
        }
        if (info.name)
            s.name = info.name
        if (info.comments)
            s.setComments(info.comments)
        this._sheet.set(sheet, s)
    }

    getRowInfo (row: number, sheet = this._activeIndex) {
        const key = genKey(sheet, row)
        return this._rowInfos.get(key) ?? new StandardRowInfo(row)
    }

    setRowInfo (row: number, info: RowInfo, sheet: number) {
        const key = genKey(sheet, row)
        const rowInfo = StandardRowInfo.from(info)
        const oldRowHeight = this._rowInfos.get(key)?.px ?? 0
        this.updateMaxHeight(this.maxHeight() + rowInfo.px - oldRowHeight)
        this._rowInfos.set(key, rowInfo)
    }

    setActiveSheet (active: number) {
        this._activeIndex = active
    }

    getActiveSheet () {
        return this._activeIndex
    }

    maxHeight () {
        return Math.max(this._maxHeight, this._dataHeight)
    }

    updateMaxHeight (maxHeight: number) {
        this._maxHeight = maxHeight
        return this.maxHeight()
    }

    maxWidth () {
        return Math.max(this._maxWidth, this._dataWidth)
    }

    updateMaxWidth (maxWidth: number) {
        this._maxWidth = maxWidth
        return this.maxWidth()
    }

    getCell (row: number, col: number, sheet = this._activeIndex) {
        const key = genKey(sheet, row, col)
        return this._cells.get(key)
    }

    setColInfo (col: number, info: ColInfo, sheet: number) {
        const key = genKey(sheet, col)
        const colInfo = StandardColInfo.from(info)
        this._colInfos.set(key, colInfo)
    }

    getColInfo (col: number, sheet = this._activeIndex) {
        const key = genKey(sheet, col)
        return this._colInfos.get(key) ?? new StandardColInfo(col)
    }
    private _maxHeight = 0
    /**
     * init from server.
     */
    private _dataHeight = 0
    private _maxWidth = 0
    /**
     * init from server.
     */
    private _dataWidth = 0
    /**
     * sheet index + row index + col index => cell info
     */
    private _cells = new Map<string, StandardCell>()
    /**
     * sheet index + row index => row info
     */
    private _rowInfos = new Map<string, StandardRowInfo>()
    /**
     * sheet index + col index => col info
     */
    private _colInfos = new Map<string, StandardColInfo>()
    /**
     * sheet index => sheet info
     */
    private _sheet = new Map<number, StandardSheet>()
    private _blocks = new Map<number, readonly StandardBlock[]>()
    private _activeIndex = 0
}

function genKey (...params: readonly (string | number)[]): string {
    return params.join('-')
}
