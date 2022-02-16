import { shallowCopy } from 'common'
import { BlockInfo } from 'proto/message'
import { Range } from './range'
export class StandardBlock implements BlockInfo {
    rowCnt = 0
    blockId = 0
    colCnt = 0
    colStart = 0
    rowStart = 0
    get coordinate() {
        const range = new Range()
        range.startRow = this.rowStart
        range.endRow = this.rowStart + this.rowCnt - 1
        range.startCol = this.colStart
        range.endCol = this.colStart + this.colCnt - 1
        return range
    }
    static from(block: BlockInfo) {
        const newBlock = new StandardBlock()
        shallowCopy(block, newBlock)
        return newBlock
    }
}
