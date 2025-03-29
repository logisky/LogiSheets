import type {Workbook, Result} from '../../packages/web'
import {DataValue, DataField} from './data'

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
