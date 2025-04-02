import {Area, Craft, WORKBOOK} from '../base/craft'
import {DataField, DataValue} from '../base/data'
import {DataRole} from './roles'

export class DataAccumulator implements Craft {
    craftId: string
    name: string
    description: string

    constructor(sheetIdx: number, rowCount: number, colCount: number) {
        this.craftId = 'data-accumulator'
        this.name = 'Data Accumulator'
        this.description = 'Data Accumulator'
        this.rowCount = rowCount
        this.colCount = colCount
        this.keyArea = {
            fromRow: 1,
            fromCol: 0,
            toRow: rowCount - 1,
            toCol: 0,
        }
        this.fieldArea = {
            fromRow: 0,
            fromCol: 1,
            toRow: 0,
            toCol: colCount - 1,
        }
        this.dataArea = {
            fromRow: 1,
            fromCol: 1,
            toRow: rowCount - 1,
            toCol: colCount - 1,
        }

        const sheetId = WORKBOOK.getSheetId(sheetIdx)
        if (typeof sheetId === 'number') {
            this._sheetId = sheetId
        } else {
            throw new Error(sheetId.msg)
        }
    }

    rowCount: number
    colCount: number
    keyArea: Area
    fieldArea: Area
    dataArea: Area

    getCorrdinate(fieldId: string, key: string): {row: number; col: number} {
        // const ws = WORKBOOK.getWorksheet(this._sheetId)
        // let r = 0
        // for (let i = 0; i < this.dataFields.length; i++) {
        //     const value = ws.getValue(
        //         this.dataArea.fromRow,
        //         this.dataArea.fromCol + i
        //     )
        // }
        throw new Error('Method not implemented.')
    }
    getKeyAndField(row: number, col: number): {fieldId: string; key: string} {
        throw new Error('Method not implemented.')
    }

    bindBlock(sheetIdx: number, blockId: number): void {
        throw new Error('Method not implemented.')
    }

    dataFields: DataField[]
    dataValues: DataValue[]

    editor(): HTMLElement {
        throw new Error('Method not implemented.')
    }

    loadRole(role: DataRole): void {
        this._role = role
    }

    private _role: DataRole | null = null

    private _sheetId!: number
}

export class Field {
    name: string
    description: string
    type: string
    defaultValue: string
    required: boolean
    validation: string
}
