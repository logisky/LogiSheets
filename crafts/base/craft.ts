import type {Workbook, Result} from '../../packages/web'
import {DataValue, DataField} from './data'
import {getValueAssertString} from './uitls'

const VALIDATION_PLACEHOLDER = '${this}'

// @ts-expect-error todo fix this
export const WORKBOOK = window.workbook as Workbook

export interface Area {
    fromRow: number
    fromCol: number
    toRow: number
    toCol: number
}

export interface Craft {
    craftId: string

    rowCount: number
    colCount: number

    name: string
    description: string

    dataFields: DataField[]
    dataValues: DataValue[]

    keyArea: Area
    fieldArea: Area
    dataArea: Area

    getCorrdinate(fieldId: string, key: string): {row: number; col: number}
    getKeyAndField(row: number, col: number): {fieldId: string; key: string}

    /**
     * A block is a place LogiSheets provides to craft to interact with.
     * Please make sure the block has enough space to render the craft.
     */
    bindBlock(sheetIdx: number, blockId: number): void

    loadRole(role?: Role): void
    editor(): HTMLElement
}

export abstract class CraftBase implements Craft {
    abstract craftId: string
    abstract name: string
    abstract description: string

    abstract dataFields: DataField[]
    abstract dataValues: DataValue[]

    constructor(
        public rowCount: number,
        public colCount: number,
        sheetId: number
    ) {
        this.sheetId = sheetId
        this.keyArea = {
            fromRow: 1,
            fromCol: 0,
            toRow: this.rowCount - 1,
            toCol: 0,
        }
        this.fieldArea = {
            fromRow: 0,
            fromCol: 1,
            toRow: 0,
            toCol: this.colCount - 1,
        }
        this.dataArea = {
            fromRow: 1,
            fromCol: 1,
            toRow: this.rowCount - 1,
            toCol: this.colCount - 1,
        }
    }

    keyArea: Area
    fieldArea: Area
    dataArea: Area
    sheetId: number

    setKeyArea(
        fromRow: number,
        fromCol: number,
        toRow: number,
        toCol: number
    ): void {
        this.keyArea = {fromRow, fromCol, toRow, toCol}
    }

    setFieldArea(
        fromRow: number,
        fromCol: number,
        toRow: number,
        toCol: number
    ): void {
        this.fieldArea = {fromRow, fromCol, toRow, toCol}
    }

    setDataArea(
        fromRow: number,
        fromCol: number,
        toRow: number,
        toCol: number
    ): void {
        this.dataArea = {fromRow, fromCol, toRow, toCol}
    }

    getCorrdinate(fieldId: string, key: string): {row: number; col: number} {
        let col = -1
        for (let r = this.fieldArea.fromRow; r <= this.fieldArea.toRow; r++) {
            for (
                let c = this.fieldArea.fromCol;
                c <= this.fieldArea.toCol;
                c++
            ) {
                const value = getValueAssertString(this.sheetId, r, c)
                for (const f of this.dataFields) {
                    if (f.id === value) {
                        col = c
                        break
                    }
                }
            }
        }

        let row = -1
        for (let r = this.keyArea.fromRow; r <= this.keyArea.toRow; r++) {
            for (let c = this.keyArea.fromCol; c <= this.keyArea.toCol; c++) {
                const value = getValueAssertString(this.sheetId, r, c)
                row = r
                break
            }
        }
        return {row, col}
    }

    getKeyAndField(row: number, col: number): {fieldId: string; key: string} {
        let field = ''
        for (let r = this.fieldArea.fromRow; r <= this.fieldArea.toRow; r++) {
            const value = getValueAssertString(this.sheetId, r, col)
            for (const f of this.dataFields) {
                if (f.id === value) {
                    field = f.id
                    break
                }
            }
        }
        const key = getValueAssertString(
            this.sheetId,
            row,
            this.keyArea.fromCol
        )
        return {fieldId: field, key: key}
    }

    bindBlock(sheetIdx: number, blockId: number): void {
        throw new Error('Method not implemented.')
    }

    abstract loadRole(role?: Role): void
    abstract editor(): HTMLElement
}

export interface Role {
    id: string
    init(userId: string): void
}

/**
 * Make sure that the validation is a pure formula which only contains the value,
 * no reference to any cells.
 */
export function validate(
    sheetIdx: number,
    validation: string
): Result<boolean> {
    return WORKBOOK.calcCondition(sheetIdx, validation)
}

export function validateWithPlaceholder(
    sheetIdx: number,
    validation: string,
    value: string
): Result<boolean> {
    return WORKBOOK.calcCondition(
        sheetIdx,
        validation.replaceAll(VALIDATION_PLACEHOLDER, value)
    )
}

/**
 * Return a block id for the craft or an error string.
 * It is users' responsibility to store the block id.
 */
export function createBlockForCraft(
    sheetIdx: number,
    startRow: number,
    startCol: number,
    rowCount: number,
    colCount: number
): number | string {
    throw new Error('Method not implemented.')
}
