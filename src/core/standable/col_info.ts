import { ColInfo } from 'proto/message'
import { findMdwColw, shallowCopy, width2px } from 'common'
export class StandardColInfo implements ColInfo {
    hidden = false
    idx = 0
    width = 0
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
