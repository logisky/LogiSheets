import {RowInfo} from 'proto/message'
import {shallowCopy, ptToPx} from 'global'
export class StandardRowInfo implements RowInfo {
    height = 0
    hidden = false
    idx = 0
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
