import {
    BlockInfo,
    ColInfo,
    Comment,
    MergeCell,
    RowInfo,
    Style,
    Value,
} from '@/bindings'
import {
    StandardBlock,
    StandardRowInfo,
    StandardColInfo,
    StandardCell,
    StandardSheet,
    Range,
} from '@/core/standable'
import {injectable} from 'inversify'

import { SETTINGS } from '@/common/settings'
import { genKey } from '@/common'
import { StandardValue } from '@/core/standable/value'
import { getID } from '@/core/ioc/id'
export const MAX_COUNT = 100000000

@injectable()
export class SheetService {
    readonly id = getID()
    constructor() {
        const sheet = this.newSheet(SETTINGS.defaultSheetName)
        this._sheet.set(0, sheet)
    }
    setBlocks (sheet: number, blocks: readonly BlockInfo[]) {
        const bls = blocks.map(b => StandardBlock.from(b))
        this._blocks.set(sheet, bls)
    }

    getBlocks (sheet = this._activeIndex) {
        return this._blocks.get(sheet) ?? []
    }
    clearAllData() {
        this._sheet.clear()
        this._cells.clear()
        this._colInfos.clear()
        this._rowInfos.clear()
        this._blocks.clear()
    }

    clear () {
        /**
         * (TODO: minglong): 考虑清楚clear的时候对standard sheet应该如何处理
         */
        const currSheet = this.getSheet()
        const newSheet = this.newSheet(currSheet?.name)
        this._sheet.set(this._activeIndex, newSheet)

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
    newSheet(name?: string) {
        const s = new StandardSheet()
        const sheets = Array.from(this._sheet.values()).map(s => s.name)
        if (name)
            s.name = name
        else {
            let num = 1
            let name = `Sheet ${num}`
            while(sheets.includes(name)) {
                num++
                name = `Sheet ${num}`
            }
            s.name = name
        }
        return s
    }

    getRowInfo (row: number, sheet = this._activeIndex) {
        const key = genKey(sheet, row)
        return this._rowInfos.get(key) ?? new StandardRowInfo(row)
    }

    setRowInfo (row: number, info: RowInfo, sheet: number) {
        const key = genKey(sheet, row)
        const rowInfo = StandardRowInfo.from(info)
        const oldRowInfo = this._rowInfos.get(key)
        const s = this._sheet.get(sheet)
        if (!s)
            return
        if (oldRowInfo)
            s.height += (rowInfo.px - oldRowInfo.px)
        else
            s.height += rowInfo.px
        this._rowInfos.set(key, rowInfo)
    }

    setActiveSheet (active: number) {
        this._activeIndex = active
    }

    getActiveSheet () {
        return this._activeIndex
    }

    getCell (row: number, col: number, sheet = this._activeIndex) {
        const key = genKey(sheet, row, col)
        return this._cells.get(key)
    }

    setColInfo (col: number, info: ColInfo, sheetIndex: number) {
        const key = genKey(sheetIndex, col)
        const colInfo = StandardColInfo.from(info)
        const oldColInfo = this._colInfos.get(key)
        const sheet = this.getSheet()
        if (!sheet)
            return
        if (oldColInfo)
            sheet.width + (colInfo.px - oldColInfo.px)
        else
            sheet.width += colInfo.px
        this._colInfos.set(key, colInfo)
    }

    getColInfo (col: number, sheet = this._activeIndex) {
        const key = genKey(sheet, col)
        return this._colInfos.get(key) ?? new StandardColInfo(col)
    }
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
