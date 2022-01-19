import {RowInfoImpl, RowInfo} from '@logi-pb/network/src/proto/message_pb'
import {shallowCopy, ptToPx} from '@logi-sheets/web/global'
export class StandardRowInfo extends RowInfoImpl {
    get pt(): number {
        return this.height
    }

    get px(): number {
        return parseFloat(ptToPx(this.height).toFixed(2))
    }

    static from(rowInfo: RowInfo): StandardRowInfo {
        const rInfo = new StandardRowInfo()
        shallowCopy(rowInfo, rInfo)
        return rInfo
    }
}
