import {shallowCopy} from '@/core'
import {BlockInfo} from '@logisheets_bg'
import {Range} from './range'
export class StandardBlock implements BlockInfo {
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
