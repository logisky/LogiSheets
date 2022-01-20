import {BlockInfoImpl, BlockInfo} from '@logi-pb/network/src/proto/message_pb'
import {shallowCopy} from '@logi-sheets/web/global'
import {RangeBuilder} from './range'

export class StandardBlock extends BlockInfoImpl {
    get coordinate() {
        return new RangeBuilder()
            .startRow(this.rowStart)
            .endRow(this.rowStart + this.rowCnt - 1)
            .startCol(this.colStart)
            .endCol(this.colStart + this.colCnt - 1)
            .build()
    }

    static from(block: BlockInfo) {
        const target = new StandardBlock()
        shallowCopy(block, target)
        return target
    }
}
