import {ColInfoImpl, ColInfo} from '@logi-pb/network/src/proto/message_pb'
import {shallowCopy, findMdwColw, width2px} from '@logi-sheets/web/global'
export class StandardColInfo extends ColInfoImpl {
    get px(): number {
        findMdwColw(this.width)
        return parseFloat(width2px(this.width).toFixed(1))
    }

    get pt(): number {
        return this.width
    }

    static from(colInfo: ColInfo): StandardColInfo {
        const cInfo = new StandardColInfo()
        shallowCopy(colInfo, cInfo)
        return cInfo
    }
}
