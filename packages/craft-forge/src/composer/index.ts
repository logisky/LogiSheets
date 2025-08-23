export * from './types'

import {
    CreateBlockBuilder,
    Payload,
    ReproduceCellsBuilder,
} from 'logisheets-web'
import {CraftDescriptor} from './types'

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
    const createBlock: Payload = {
        type: 'createBlock',
        value: new CreateBlockBuilder()
            .sheetIdx(sheetIdx)
            .id(blockId)
            .masterRow(masterRow)
            .masterCol(masterCol)
            .rowCnt(craftDescriptor.workbookPart.rowCount)
            .colCnt(craftDescriptor.workbookPart.colCount)
            .build(),
    }
    result.push(createBlock)

    const reproduceCells: Payload = {
        type: 'reproduceCells',
        value: new ReproduceCellsBuilder()
            .sheetIdx(sheetIdx)
            .startRow(masterRow)
            .startCol(masterCol)
            .cells(craftDescriptor.workbookPart.cells)
            .build(),
    }
    result.push(reproduceCells)

    return result
}
