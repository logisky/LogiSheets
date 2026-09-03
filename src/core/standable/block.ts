import {shallowCopy} from 'logisheets-core'
import {
    BlockCellInfo,
    BlockInfo,
    BlockPermissions,
    BlockSchema,
    FieldRenderEntry,
    ModifyPolicy,
} from 'logisheets-engine'
import {Range} from './range'
export class StandardBlock implements BlockInfo {
    cells: readonly BlockCellInfo[] = []
    sheetIdx = 0
    sheetId = 0
    rowCnt = 0
    blockId = 0
    colCnt = 0
    colStart = 0
    rowStart = 0
    get coordinate() {
        return new Range()
            .setStartRow(this.rowStart)
            .setEndRow(this.rowStart + this.rowCnt - 1)
            .setStartCol(this.colStart)
            .setEndCol(this.colStart + this.colCnt - 1)
    }
    schema?: BlockSchema
    fieldRenders: readonly FieldRenderEntry[] = []
    /**
     * What the block is for, and who may change it. Defaults match a block
     * that declares nothing: no description, no owner, and one open policy —
     * `shallowCopy` in `from` overwrites them with whatever the engine sent.
     *
     * Do not read `permissions` apart to decide whether an edit is allowed:
     * ask the workbook's `mayModifyBlock`, so the app and the craft runtime
     * cannot disagree about what a policy means.
     */
    description = ''
    owner = ''
    modifyPolicy: ModifyPolicy = 'all'
    permissions: BlockPermissions = {}
    static from(block: BlockInfo) {
        const newBlock = new StandardBlock()
        shallowCopy(block, newBlock)
        return newBlock
    }
}
