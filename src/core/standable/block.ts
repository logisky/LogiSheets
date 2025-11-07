import {shallowCopy} from '@/core'
import {BlockCellInfo, BlockInfo, BlockLineInfo} from 'logisheets-web'
import {Range} from './range'
export class StandardBlock implements BlockInfo {
    cells: readonly BlockCellInfo[] = []
    rowInfos: readonly BlockLineInfo[] = []
    colInfos: readonly BlockLineInfo[] = []
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
    static from(block: BlockInfo) {
        const newBlock = new StandardBlock()
        shallowCopy(block, newBlock)
        return newBlock
    }
}
