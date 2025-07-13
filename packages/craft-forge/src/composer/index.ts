export * from './types'

import {
    CellInputBuilder,
    CreateAppendixBuilder,
    CreateBlockBuilder,
    Payload,
    Value,
} from 'logisheets-web'
import {Appendix, CraftDescriptor, ReproducibleCell} from './types'

export function generatePayloads(
    sheetIdx: number,
    blockId: number,
    masterRow: number,
    masterCol: number,
    craftDescriptor: CraftDescriptor
): readonly Payload[] {
    if (!craftDescriptor.workbookPart) {
        throw new Error('Craft descriptor must have a workbook part')
    }
    const result: Payload[] = []
    const createBlock = new CreateBlockBuilder()
        .sheetIdx(sheetIdx)
        .id(blockId)
        .masterRow(masterRow)
        .masterCol(masterCol)
        .rowCnt(craftDescriptor.workbookPart.rowCount)
        .colCnt(craftDescriptor.workbookPart.colCount)
        .build() as Payload
    result.push(createBlock)

    craftDescriptor.workbookPart.cells.forEach((cell: ReproducibleCell) => {
        if (cell.formula) {
            const cellInput = new CellInputBuilder()
                .sheetIdx(sheetIdx)
                .row(cell.coordinate.row + masterRow)
                .col(cell.coordinate.col + masterCol)
                .content(cell.formula)
                .build() as Payload
            result.push(cellInput)
        } else if (cell.value) {
            const cellInput = new CellInputBuilder()
                .sheetIdx(sheetIdx)
                .row(cell.coordinate.row + masterRow)
                .col(cell.coordinate.col + masterCol)
                .content(valueToStr(cell.value))
                .build() as Payload
            result.push(cellInput)
        }

        cell.appendix.forEach((appendix: Appendix) => {
            const addAppendix = new CreateAppendixBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .tag(appendix.tag)
                .content(appendix.content)
                .rowIdx(cell.coordinate.row)
                .colIdx(cell.coordinate.col)
                .build() as Payload
            result.push(addAppendix)
            // todo: add style payloads
        })
    })
    return result
}

function valueToStr(value: Value): string {
    if (value === 'empty') {
        return ''
    }
    if (hasOwnProperty(value, 'str')) {
        return value.str as string
    }
    if (hasOwnProperty(value, 'bool')) {
        const v = value.bool as boolean
        return v ? 'TRUE' : 'FALSE'
    }
    if (hasOwnProperty(value, 'number')) {
        return (value.number as number).toString()
    }
    if (hasOwnProperty(value, 'error')) {
        return value.error as string
    }
    return ''
}

function hasOwnProperty<T, K extends PropertyKey>(
    obj: T,
    prop: K
): obj is T & Record<K, unknown> {
    return Object.prototype.hasOwnProperty.call(obj, prop)
}
